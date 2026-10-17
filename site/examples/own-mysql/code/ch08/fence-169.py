"""SQLite reference: versioned complete after-images, not a CDC connector."""
import sqlite3

def init(c):
    c.executescript('''
      CREATE TABLE fact(id TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL,
        day TEXT NOT NULL, shop TEXT NOT NULL, cents INTEGER NOT NULL,
        active INTEGER NOT NULL CHECK(active IN (0,1)));
      CREATE TABLE seen_fact(id TEXT NOT NULL, version INTEGER NOT NULL,
        day TEXT NOT NULL, shop TEXT NOT NULL, cents INTEGER NOT NULL,
        active INTEGER NOT NULL CHECK(active IN (0,1)), PRIMARY KEY(id,version));
      CREATE TABLE daily(day TEXT NOT NULL, shop TEXT NOT NULL,
        n INTEGER NOT NULL, cents INTEGER NOT NULL, PRIMARY KEY(day,shop));
    ''')

def apply(c, key, version, day, shop, cents, active):
    if type(version) is not int or not 1 <= version <= 2**63-1 or type(cents) is not int:
        raise ValueError("bad version/amount")
    if abs(cents) > 10**9 or type(active) is not bool:
        raise ValueError("reference amount domain or active flag")
    # This reference uses sqlite3 legacy transaction control and owns its transaction.
    if getattr(c, "autocommit", None) is True or c.in_transaction:
        raise ValueError("requires dedicated idle legacy-mode connection")
    new = (version, day, shop, cents, int(active))
    with c:
        c.execute("BEGIN IMMEDIATE")
        seen = c.execute("SELECT day,shop,cents,active FROM seen_fact WHERE id=? AND version=?", (key, version)).fetchone()
        if seen is not None:
            if seen != new[1:]:
                raise ValueError("same observed version has different content")
        else:
            c.execute("INSERT INTO seen_fact VALUES(?,?,?,?,?,?)", (key,) + new)
        old = c.execute("SELECT version,day,shop,cents,active FROM fact WHERE id=?", (key,)).fetchone()
        if old and version <= old[0]:
            if version == old[0] and old != new:
                raise ValueError("same version has different content")
            return False
        for row, sign in ((old, -1), (new, 1)):
            if row and row[4]:
                total = c.execute("SELECT n,cents FROM daily WHERE day=? AND shop=?", row[1:3]).fetchone()
                count, amount = total if total is not None else (0, 0)
                if type(count) is not int or type(amount) is not int:
                    raise ValueError("noninteger aggregate state")
                count += sign
                amount += sign * row[3]
                if not 0 <= count <= 2**63-1 or not -(2**63) <= amount <= 2**63-1:
                    raise OverflowError("aggregate exceeds signed 64-bit domain")
                c.execute('''INSERT INTO daily VALUES(?,?,?,?)
                  ON CONFLICT(day,shop) DO UPDATE SET n=excluded.n,cents=excluded.cents''',
                  (row[1], row[2], count, amount))
        c.execute("DELETE FROM daily WHERE n=0 AND cents=0")
        c.execute('''INSERT INTO fact VALUES(?,?,?,?,?,?) ON CONFLICT(id)
          DO UPDATE SET version=excluded.version,day=excluded.day,shop=excluded.shop,
          cents=excluded.cents,active=excluded.active''', (key,) + new)
    return True

def reconcile(c):
    actual = c.execute("SELECT day,shop,n,cents FROM daily ORDER BY day,shop").fetchall()
    expect = c.execute('''SELECT day,shop,COUNT(*),SUM(cents) FROM fact
      WHERE active=1 GROUP BY day,shop ORDER BY day,shop''').fetchall()
    return actual == expect
