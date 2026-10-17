"""Python 3 + SQLite teaching comparison. Not an InnoDB locking simulator.
No network, dispatcher or external operation is performed.
"""
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

EDGES = {("NEW", "RUNNING"), ("RUNNING", "SUCCEEDED"), ("RUNNING", "FAILED")}
MAX_VERSION = 2**63 - 1

def connect(path):
    c = sqlite3.connect(path, timeout=3, isolation_level=None)
    c.execute("PRAGMA foreign_keys=ON")
    return c

def init(c):
    c.executescript("""
      CREATE TABLE task(tenant TEXT NOT NULL,id TEXT NOT NULL,state TEXT NOT NULL,
        version INTEGER NOT NULL CHECK(version>=0),PRIMARY KEY(tenant,id));
      CREATE TABLE receipt(tenant TEXT NOT NULL,op TEXT NOT NULL,request TEXT NOT NULL,
        result TEXT NOT NULL,PRIMARY KEY(tenant,op));
      CREATE TABLE outbox(tenant TEXT NOT NULL,op TEXT NOT NULL,task_id TEXT NOT NULL,
        state TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(tenant,op),
        FOREIGN KEY(tenant,task_id) REFERENCES task(tenant,id));
    """)

def transition(c, tenant, task, op, state, version, target, fail_outbox=False):
    if (state, target) not in EDGES or type(version) is not int or not 0 <= version < MAX_VERSION:
        raise ValueError("invalid edge/version")
    if any(not isinstance(s, str) or not 1 <= len(s) <= 100 for s in (tenant, task, op)):
        raise ValueError("bounded identities required")
    request = json.dumps([task, state, version, target], ensure_ascii=False, separators=(",", ":"))
    c.execute("BEGIN IMMEDIATE")
    try:
        old = c.execute("SELECT request,result FROM receipt WHERE tenant=? AND op=?", (tenant, op)).fetchone()
        if old:
            if old[0] != request:
                raise ValueError("operation ID reused")
            c.commit()
            return old[1]
        changed = c.execute("""UPDATE task SET state=?,version=version+1
            WHERE tenant=? AND id=? AND state=? AND version=?""",
            (target, tenant, task, state, version)).rowcount
        result = "APPLIED" if changed == 1 else "CONFLICT_OR_MISSING"
        c.execute("INSERT INTO receipt VALUES(?,?,?,?)", (tenant, op, request, result))
        if changed:
            if fail_outbox:
                raise RuntimeError("injected before outbox")
            c.execute("INSERT INTO outbox VALUES(?,?,?,?,?)", (tenant, op, task, target, version + 1))
        c.commit()
        return result
    except BaseException:
        c.rollback()
        raise

def self_test():
    with TemporaryDirectory(prefix="state-cas-", dir=Path(__file__).resolve().parent) as tmp:
        path = str(Path(tmp) / "lab.db")
        with connect(path) as c:
            init(c)
            c.execute("INSERT INTO task VALUES('t','job','NEW',0)")
        def race(i):
            c = connect(path)
            try:
                return i, transition(c, "t", "job", f"op{i}", "NEW", 0, "RUNNING")
            finally:
                c.close()
        with ThreadPoolExecutor(max_workers=8) as pool:
            outcomes = list(pool.map(race, range(64)))
        wins = [i for i, result in outcomes if result == "APPLIED"]
        assert len(wins) == 1
        c = connect(path)
        try:
            assert c.execute("SELECT state,version FROM task").fetchone() == ("RUNNING", 1)
            assert c.execute("SELECT COUNT(*) FROM outbox").fetchone()[0] == 1
            assert transition(c, "t", "job", f"op{wins[0]}", "NEW", 0, "RUNNING") == "APPLIED"
            try:
                transition(c, "t", "job", "complete", "RUNNING", 1, "SUCCEEDED", True)
                raise AssertionError("expected injection")
            except RuntimeError:
                pass
            assert c.execute("SELECT state,version FROM task").fetchone() == ("RUNNING", 1)
            assert c.execute("SELECT COUNT(*) FROM receipt WHERE op='complete'").fetchone()[0] == 0
            assert transition(c, "t", "job", "complete", "RUNNING", 1, "SUCCEEDED") == "APPLIED"
            try:
                transition(c, "t", "job", "complete", "RUNNING", 1, "FAILED")
                raise AssertionError("expected payload conflict")
            except ValueError:
                pass
            assert transition(c, "other", "job", "x", "NEW", 0, "RUNNING") == "CONFLICT_OR_MISSING"
            assert c.execute("SELECT COUNT(*) FROM outbox").fetchone()[0] == 2
        finally:
            c.close()
    print("PASS: SQLite transition/receipt/outbox model, 64 contenders, rollback and tenant boundary; not MySQL")

if __name__ == "__main__":
    print("SQLite", sqlite3.sqlite_version)
    self_test()
