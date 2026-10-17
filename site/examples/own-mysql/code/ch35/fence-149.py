"""Python DB-API reference, NOT an ORM integration or a MySQL wire benchmark."""
import math
import sqlite3

MAX_BATCH = 256

def init(c):
    c.executescript('''
      CREATE TABLE specimen(tenant INTEGER NOT NULL,id TEXT NOT NULL,state TEXT NOT NULL,
        expected INTEGER,PRIMARY KEY(tenant,id),CHECK(state IN ('OPEN','COMPLETE')));
      CREATE TABLE measurement(tenant INTEGER NOT NULL,specimen_id TEXT NOT NULL,
        seq INTEGER NOT NULL CHECK(seq>=0),sensor TEXT NOT NULL,value REAL NOT NULL,
        PRIMARY KEY(tenant,specimen_id,seq),
        FOREIGN KEY(tenant,specimen_id) REFERENCES specimen(tenant,id));
    ''')

def batch(c, tenant, specimen, samples, inject_failure=False):
    # Python 3.12 autocommit=True makes the connection context manager a no-op.
    if c.autocommit != sqlite3.LEGACY_TRANSACTION_CONTROL:
        raise ValueError('requires LEGACY_TRANSACTION_CONTROL')
    # Materialize at most a caller-bounded batch, never an entire long experiment.
    if not isinstance(samples, (list, tuple)) or len(samples)>MAX_BATCH:
        raise ValueError('bounded list/tuple required')
    for seq, sensor, value in samples:
        if type(seq) is not int or not 0<=seq<1000000 or not isinstance(sensor,str) or not 1<=len(sensor)<=80:
            raise ValueError('bad sample identity')
        if type(value) not in (int,float) or not math.isfinite(value) or abs(value)>1e9:
            raise ValueError('bad finite measurement')
    if c.in_transaction:
        raise ValueError('requires dedicated idle connection')
    with c:
        c.execute('BEGIN IMMEDIATE')
        state=c.execute('SELECT state FROM specimen WHERE tenant=? AND id=?',(tenant,specimen)).fetchone()
        if not state or state[0]!='OPEN': raise ValueError('unknown or closed specimen')
        # In sqlite3 executemany runs the statement repeatedly. It is not proof of
        # one multi-row INSERT, one network roundtrip, or an ORM flush strategy.
        c.executemany('INSERT INTO measurement VALUES(?,?,?,?,?) ON CONFLICT(tenant,specimen_id,seq) DO NOTHING',
                      [(tenant,specimen,*row) for row in samples])
        for seq,sensor,value in samples:
            actual=c.execute('SELECT sensor,value FROM measurement WHERE tenant=? AND specimen_id=? AND seq=?',
                             (tenant,specimen,seq)).fetchone()
            if actual!=(sensor,value): raise ValueError('same sample sequence has different payload')
        if inject_failure: raise RuntimeError('injected before commit')

def publish(c, tenant, specimen, expected):
    # Python 3.12 autocommit=True makes the connection context manager a no-op.
    if c.autocommit != sqlite3.LEGACY_TRANSACTION_CONTROL:
        raise ValueError('requires LEGACY_TRANSACTION_CONTROL')
    if type(expected) is not int or not 0<=expected<=1000000 or c.in_transaction:
        raise ValueError('bad count or connection')
    with c:
        c.execute('BEGIN IMMEDIATE')
        old=c.execute('SELECT state,expected FROM specimen WHERE tenant=? AND id=?',(tenant,specimen)).fetchone()
        if not old: raise ValueError('unknown specimen')
        if old[0]=='COMPLETE':
            if old[1]!=expected: raise ValueError('conflicting manifest')
            return
        n,low,high=c.execute('SELECT COUNT(*),MIN(seq),MAX(seq) FROM measurement WHERE tenant=? AND specimen_id=?',
                            (tenant,specimen)).fetchone()
        if n!=expected or (n and (low!=0 or high!=n-1)): raise ValueError('incomplete contiguous samples')
        c.execute("UPDATE specimen SET state='COMPLETE',expected=? WHERE tenant=? AND id=?",(expected,tenant,specimen))

def read_complete(c, tenant, specimen):
    # Bound the reader externally or iterate the cursor; no fetchall for a giant run.
    return c.execute('''SELECT m.seq,m.sensor,m.value FROM measurement m JOIN specimen s
      ON m.tenant=s.tenant AND m.specimen_id=s.id
      WHERE s.tenant=? AND s.id=? AND s.state='COMPLETE' ORDER BY m.seq''',(tenant,specimen))



def main():
    c = sqlite3.connect(':memory:', autocommit=sqlite3.LEGACY_TRANSACTION_CONTROL)
    try:
        c.execute('PRAGMA foreign_keys=ON')
        init(c)
        with c:
            c.execute("INSERT INTO specimen VALUES(1,'sample','OPEN',NULL)")
        batch(c, 1, 'sample', [(0, 'temperature', 20.0), (1, 'pressure', 1.0)])
        batch(c, 1, 'sample', [(0, 'temperature', 20.0)])
        try:
            batch(c, 1, 'sample', [(2, 'flow', 2.0)], inject_failure=True)
            raise AssertionError('injected failure missing')
        except RuntimeError:
            pass
        assert c.execute('SELECT COUNT(*) FROM measurement').fetchone()[0] == 2
        publish(c, 1, 'sample', 2)
        assert list(read_complete(c, 1, 'sample')) == [(0, 'temperature', 20.0), (1, 'pressure', 1.0)]
        print('PASS SQLite teaching protocol; no ORM or MySQL connection')
    finally:
        c.close()

if __name__ == '__main__':
    main()
