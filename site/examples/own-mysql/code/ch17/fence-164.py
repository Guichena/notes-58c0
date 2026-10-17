"""SQLite relational checks only. No MySQL optimizer, collation, locking or I/O claims."""
from pathlib import Path
import sqlite3,re,math,random,datetime,json
ROOT=Path(__file__).resolve().parent
results=[]
def run_file(name):
    db=sqlite3.connect(':memory:',isolation_level=None);db.execute('PRAGMA foreign_keys=ON')
    db.create_function('IF',3,lambda test,a,b:a if test else b)
    db.create_function('MOD',2,lambda a,b:a%b)
    db.create_function('FLOOR',1,math.floor)
    db.create_function('CONCAT',-1,lambda *xs:''.join(map(str,xs)))
    db.create_function('REPEAT',2,lambda s,n:s*n)
    db.create_function('TIMESTAMPADD',3,lambda unit,n,s:(datetime.datetime.fromisoformat(s)+datetime.timedelta(seconds=n)).isoformat(' ',timespec='microseconds'))
    sql=re.sub(r'--[^\n]*','',(ROOT/name).read_text())
    sets={'uid':12345,'tenant':7,'as_of':'2026-10-09 00:00:00.000000','lower':'2026-10-02 00:00:00.000000',
      'window_end':'2026-10-09 00:00:00.000000','window_start':'2026-09-09 00:00:00.000000',
      'last_time':'2026-10-08 12:00:00.123456','last_id':7,'threshold':5,'bv':2,'cv':9,'last_nickname_id':0}
    selects=[];dml_counts=[]
    for statement in sql.split(';'):
      q=statement.strip()
      if not q or re.match(r'(SET\b|EXPLAIN\b|ANALYZE\b)',q,re.I):continue
      if 'ROW_COUNT()' in q:selects.append([(dml_counts[-1],)]);continue
      q=re.sub(r'ENGINE\s*=\s*InnoDB','',q,flags=re.I)
      q=q.replace('AUTO_INCREMENT','').replace('START TRANSACTION','BEGIN')
      # Ignore physical key declarations but preserve their columns, rows and constraints.
      q=re.sub(r',\s*(?:INDEX|KEY)\s+\w+\s*\([^)]*\)','',q,flags=re.I)
      q=re.sub(r'\s+(?:FORCE|IGNORE) INDEX\s*\([^)]*\)','',q,flags=re.I)
      q=q.replace('TIMESTAMPADD(SECOND,',"TIMESTAMPADD('SECOND',")
      q=re.sub(r'@(\w+)',lambda m:repr(sets[m[1]]),q)
      # DATETIME(6) normalizes omitted fractional seconds in MySQL.
      # SQLite uses text here, so explicitly normalize literals to the same precision.
      q=re.sub(r"'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'",lambda m:"'"+m[1]+".000000'",q)
      cur=db.execute(q)
      if q.upper().startswith(('SELECT','WITH')):selects.append(cur.fetchall())
      if q.upper().startswith(('INSERT','UPDATE','DELETE')):dml_counts.append(cur.rowcount)
    return db,selects,dml_counts

def ids(rows):return [r[0] for r in rows]
def check(label,condition):
    if not condition:raise AssertionError(label)
    results.append(label)

for name,expected in [('range_probe.sql',[3,5]),('composite_indexes.sql',[3,5]),('purchase.sql',[5,2])]:
    db,q,_=run_file(name);check(name,ids(q[0])==expected)
    if name=='composite_indexes.sql':check('predicate reordering',q[0]==q[1])
db,q,_=run_file('merchant_index.sql');check('merchant3 order2',ids(q[0])==[2])
db,q,_=run_file('index_cases.sql');check('status0 age>12',ids(q[0])==[2,4]);check('IN five ranges',ids(q[1])==[2,3,8] and q[1]==q[2])
db,q,_=run_file('surname.sql');check('surname membership',set(ids(q[0]))=={1,4,5})
db,q,_=run_file('index_organization.sql');check('cover projection identity',ids(q[0])==ids(q[1])==[1,2])
db,q,_=run_file('book.sql');check('original book',ids(q[0])==[1]);check('tenant book',ids(q[1])==[1])
db,q,_=run_file('user_indexes.sql')
check('original first page has no sentinel',ids(q[0])==[-1,0])
check('original continuation uses actual last id',ids(q[1])==[1,2])
check('tenant first page has no sentinel',ids(q[3])==[-1,0])
check('tenant continuation uses actual last id',ids(q[4])==[1,2])
check('exact original and tenant hobby counts',q[2]==q[5]==q[6]==[(2,)])
for sql in ["INSERT INTO user_hobby VALUES(7,10,1)","INSERT INTO user_hobby VALUES(9,10,1)"]:
    try:db.execute(sql);raise AssertionError('constraint missing')
    except sqlite3.IntegrityError:results.append('membership identity/tenant FK rejected')
db,q,_=run_file('or_top10.sql');check('OR top10 fixed fixture',q[0]==q[1]);check('NULL P row retained',3 in ids(q[0]) and 5 in ids(q[0]))
# Random SQL differential test, same relational operators and explicit d DESC,id DESC order.
rng=random.Random(20261010)
for iteration in range(500):
    db.execute('DELETE FROM top_items')
    db.executemany('INSERT INTO top_items VALUES(?,?,?,?,?,?)',[(i,rng.choice([None,1,5,6,9]),rng.choice([None,1,2]),rng.choice([None,1,9]),rng.choice([None,1,2,3,4]),str(i)) for i in range(1,101)])
    baseline=db.execute('SELECT * FROM top_items WHERE (a>5 AND b=2) OR c=9 ORDER BY d DESC,id DESC LIMIT 10').fetchall()
    rewritten=db.execute('WITH p AS(SELECT * FROM top_items WHERE a>5 AND b=2 ORDER BY d DESC,id DESC LIMIT 10), q AS(SELECT * FROM top_items WHERE c=9 AND (a>5 AND b=2) IS NOT TRUE ORDER BY d DESC,id DESC LIMIT 10) SELECT * FROM(SELECT * FROM p UNION ALL SELECT * FROM q) ORDER BY d DESC,id DESC LIMIT 10').fetchall()
    check('OR randomized '+str(iteration),baseline==rewritten)
db,q,_=run_file('page_orders.sql');check('offset10000',ids(q[0])==list(range(500,450,-1)));check('deferred join equality',q[0]==q[1]);check('tie cursor900',ids(q[2])==list(range(899,849,-1)))
db,q,_=run_file('page_fixture.sql');check('B offset/deferred',q[0]==q[1]);check('B boundary continuation',q[0]==q[2])
db,q,_=run_file('transactions_page.sql');check('30day first',ids(q[0])==[8,7]);check('30day next',ids(q[1])==[4,1])
db,q,_=run_file('task_query.sql');check('seven day priority then time',ids(q[0])==[8,1,7,2])
db,q,_=run_file('feed_item.sql');check('feed first/next',ids(q[0])==[6,5] and ids(q[1])==[4,3]);check('CAS stale version',q[2]==[(1,)] and q[3]==[(0,)])
db,q,_=run_file('s1_orders.sql');check('S1 skewed population',q[0]==[(1,80000,800)]+[(t,1000,10) for t in range(2,22)]);check('S1 correlation retains count',q[1]==[(80000,800)])
print(json.dumps({'status':'PASS','sqlite_version':sqlite3.sqlite_version,'checks':len(results),
 'random_OR_cases':500,'scope':'Relational fixture/sequence assertions after explicit SQLite syntax adaptation',
 'not_verified':['MySQL SQL execution','MySQL plans and ICP','MySQL collation and numeric conversion','MySQL isolation and locks','Online DDL','physical I/O','ClickHouse/HBase services']},ensure_ascii=False,indent=2))
