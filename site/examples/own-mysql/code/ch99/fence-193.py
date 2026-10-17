"""Portable SQL value/constraint oracle and SQLite projection model; not MySQL integration."""
from pathlib import Path
import sqlite3,sys,random,itertools,tempfile,importlib.util,json
ROOT=Path(__file__).resolve().parents[1];CODE=ROOT/'code';checks=0

def eq(actual,expected,label):
 global checks
 checks+=1
 if actual!=expected:raise AssertionError((label,actual,expected))

def connect():
 c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
 # Deterministic functions used by report_scope.sql's canonical ASCII domain.
 c.create_function('CHAR_LENGTH',1,lambda s:None if s is None else len(s),deterministic=True)
 c.create_function('ASCII',1,lambda s:None if s is None else (s.encode('utf-8')[0] if s else 0),deterministic=True)
 return c

def statements(text):
 buf=''
 for line in text.splitlines(True):
  if line.lstrip().startswith('--'):continue
  if 'INDEX idx_order_product' in line:continue # MySQL inline index is access-path-only.
  if line.lstrip().startswith('KEY ix_department_salary'):continue
  # SQLite BINARY is sufficient for this closed ASCII domain; this does not test MySQL collations.
  line=line.replace(' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin','')
  buf+=line.replace(' ENGINE=InnoDB','')
  if sqlite3.complete_statement(buf):yield buf.strip();buf=''
 if buf.strip():raise AssertionError('incomplete SQL fixture')

def run(c,name,params=None):
 results=[]
 for s in statements((CODE/name).read_text()):
  if '?' in s and params is None:continue
  if s.upper()=='START TRANSACTION;':c.commit();s='BEGIN;'
  cur=c.execute(s,params if '?' in s else ())
  if cur.description:results.append(cur.fetchall())
 return results

def fails(c,sql,args=()):
 global checks
 checks+=1
 try:c.execute(sql,args)
 except sqlite3.IntegrityError:return
 raise AssertionError('constraint unexpectedly accepted '+sql)

c=connect();run(c,'normalization.sql');run(c,'normalization_seed.sql');run(c,'scores_setup.sql')
eq(run(c,'scores_winners.sql')[-1],[(1,'same',170),(2,'same',170)],'all highest ties')
eq(run(c,'scores_variants.sql'),[[(1,'same',170),(2,'same',170)],[(1,'same',170)]],'zero and stable winner contracts')
fails(c,'INSERT INTO scores VALUES(1,1,50)');fails(c,'INSERT INTO scores VALUES(999,1,50)')
c=connect();run(c,'sales_setup.sql')
eq(run(c,'sales_threshold.sql')[-1],[(1,10,'same',110000),(1,30,'other',110000),(1,40,'boundary',100000.01)],'strict money threshold')
eq([(a,b) for a,b,_,_ in run(c,'sales_rank.sql')[-1]],[(1,10),(1,30),(2,10)],'merchant ties')
eq(run(connect(),'join_semantics.sql'),[[(1,10),(2,None),(3,None)],[(1,10)],[(1,2),(2,1),(3,0)]],'LEFT ON WHERE count')
eq(run(connect(),'exact_two_courses.sql')[-1],[(1,),(4,)],'distinct course count')
eq(run(connect(),'null_predicates.sql'),[[(1,),(4,)],[],[(2,),(3,)]],'three valued NULL')
eq(run(connect(),'pivot_scores.sql')[-1],[(1,80,90,70),(2,0,None,None),(3,None,None,50)],'pivot NULL vs zero')
res=run(connect(),'blog_ranking.sql');eq(res[0],[(1,'first',2),(2,'second',1),(3,'third',1)],'daily LIKE transitions');eq(res[1],[(3,'third',400),(2,'second',400),(1,'first',300)],'recent update ties')
res=run(connect(),'aggregate.sql');eq(res[0],[(1,3,2,300,150.0,100,200)],'WHERE HAVING NULL denominators');eq(res[1],[(1,'Engineering',3,300),(2,'Support',2,100),(3,'Empty',0,0)],'empty groups');eq(res[2],[(1,2,2)],'salary duplicates are distinct employees')
eq(run(connect(),'student_totals.sql'),[[(1,)],[('A',350),('B',100),('C',0)]],'avg under90 and class total')
eq(run(connect(),'shop_totals.sql')[-1],[(1,'Same','Food',2,300),(2,'Same','Food',0,0),(3,'Other','Books',1,0),(4,'NoOrders','Books',0,0)],'all merchants retained')
c=connect();eq(run(c,'unique_null.sql')[-1],[(3,)],'multiple NULL unique');fails(c,"INSERT INTO unique_probe VALUES(9,1,'a')");fails(c,"INSERT INTO unique_probe VALUES(10,1,'')")
c=connect();eq(run(c,'subway.sql'),[[(1,)],[(10,'Red')]],'shared line');eq(c.execute('SELECT EXISTS(SELECT 1 FROM metro_line_station a JOIN metro_line_station b ON a.line_id=b.line_id WHERE a.station_id=2 AND b.station_id=3)').fetchone(),(0,),'transfer is not same line')
c=connect();res=run(c,'course_schema.sql');eq(res[-1],[(10,2,2),(20,1,1),(30,0,0)],'exact teacher cardinalities');fails(c,"INSERT INTO teacher VALUES(999,'x',NULL)");fails(c,'INSERT INTO enrollment VALUES(1,10)')
c=connect();run(c,'relations.sql');fails(c,"INSERT INTO rel_profile VALUES(1,'duplicate')");fails(c,'INSERT INTO rel_order VALUES(12,999)')
eq(run(connect(),'expiry_model.sql'),[[(2,),(3,)],[(1,)]],'expiry equals now invalid')
c=connect();run(c,'history_model.sql');c.execute("INSERT INTO customer_history VALUES(1,1,'北京',10,20,NULL)");c.execute("INSERT INTO customer_history VALUES(1,2,'上海',20,NULL,1)")
eq(c.execute('SELECT city FROM customer_history WHERE customer_id=1 AND valid_from<=20 AND (valid_to>20 OR valid_to IS NULL)').fetchall(),[('上海',)],'SCD halfopen');fails(c,"INSERT INTO customer_history VALUES(1,3,'杭州',30,NULL,1)");fails(c,"INSERT INTO customer_history VALUES(2,1,'x',30,20,NULL)")
c=connect();run(c,'table_diff_schema.sql');sql='SELECT business_id,payload,SUM(delta) FROM (SELECT business_id,payload,-1 delta FROM compare_a UNION ALL SELECT business_id,payload,1 delta FROM compare_b) GROUP BY business_id,payload HAVING SUM(delta)<>0'
eq(set(c.execute(sql)),{(1,'old',-1),(1,'new',1),(2,None,-1),(3,'x',2),(4,'y',1)},'net2 is five value differences')
# All remaining portable DDL initializes separately. Parameterized operations are never guessed.
for name in ['user_schema.sql','workorder_schema.sql','vessel_schema.sql','video_schema.sql','playlist_schema.sql','post_schema.sql','conversation_schema.sql','report_schema.sql','report_scope.sql','comment_schema.sql','video_transcript.sql','duplicate_names.sql','duplicate_rows.sql']:
 run(connect(),name);checks+=1
# Canonical report domain: reject malformed stored state/currency rather than hide it in Java.
c=connect();run(c,'report_scope.sql')
for status,currency in [('paid','USD'),('PAID ','USD'),('PAID','usd'),('PAID','US '),('PAID','ＵＳＤ'),('PAID','US'),('PAID','US1')]:
 fails(c,'INSERT INTO crm_order VALUES(1,1,10,?,?,100,10)',(status,currency))
c.executemany('INSERT INTO crm_order VALUES(1,?,10,?,?,?,10)',[(1,'PAID','USD',100),(2,'PAID','USD',200),(3,'OPEN','USD',900),(4,'REFUNDED','EUR',500)])
c.executemany('INSERT INTO department_grant VALUES(1,7,?,10)',[(1,),(2,)])
eq(c.execute("SELECT currency,COUNT(*),SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END),SUM(CASE WHEN status='PAID' THEN amount_minor ELSE 0 END) FROM crm_order o WHERE tenant_id=1 AND EXISTS(SELECT 1 FROM department_grant g WHERE g.tenant_id=o.tenant_id AND g.principal_id=7 AND g.dept_id=o.dept_id) GROUP BY currency ORDER BY currency").fetchall(),[('EUR',1,0,0),('USD',3,2,300)],'canonical report groups and nonmultiplying authorization')
# Independent randomized multiset oracle including duplicate NULL values.
rng=random.Random(118431);domain=[(None,None),(1,'a'),(1,'b'),(2,None),(3,"x'y")]
for _ in range(300):
 c=connect();c.executescript('CREATE TABLE compare_a(business_id INT,payload TEXT);CREATE TABLE compare_b(business_id INT,payload TEXT);')
 a=[rng.choice(domain) for _ in range(rng.randrange(20))];b=[rng.choice(domain) for _ in range(rng.randrange(20))]
 c.executemany('INSERT INTO compare_a VALUES(?,?)',a);c.executemany('INSERT INTO compare_b VALUES(?,?)',b)
 expected={(k[0],k[1],b.count(k)-a.count(k)) for k in domain if b.count(k)!=a.count(k)};eq(set(c.execute(sql)),expected,'random multiset')
# The full supplied projection model executes its own local SQLite transactions.
spec=importlib.util.spec_from_file_location('projection',CODE/'preaggregate.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
versions=[(1,'D1','A',100,True),(2,'D2','B',120,True),(3,'D2','B',80,True),(4,'D2','B',0,False)]
for perm in itertools.permutations(versions):
 c=connect();p.init(c)
 for event in perm:p.apply(c,'k',*event);eq(p.reconcile(c),True,'permutation reconcile')
 eq(c.execute('SELECT version,active FROM fact').fetchone(),(4,0),'delete wins');eq(c.execute('SELECT COUNT(*) FROM daily').fetchone(),(0,),'no resurrected contribution')
 try:p.apply(c,'k',1,'WRONG','A',100,True)
 except ValueError:checks+=1
 else:raise AssertionError('historical conflicting payload accepted')
c=connect();p.init(c);p.apply(c,'k',*versions[0]);c.execute("CREATE TRIGGER inject_fail BEFORE INSERT ON daily BEGIN SELECT RAISE(ABORT,'inject');END")
try:p.apply(c,'z',1,'D3','C',10,True)
except sqlite3.IntegrityError:checks+=1
else:raise AssertionError('failure injection failed')
eq(c.execute("SELECT COUNT(*) FROM seen_fact WHERE id='z'").fetchone(),(0,),'projection failure rolls back seen ledger')
c.execute('DROP TRIGGER inject_fail');p.apply(c,'z',1,'D3','C',10,True);eq(p.reconcile(c),True,'replay after rollback')
for i in range(500):
 key=str(rng.randrange(30));version=rng.randrange(1,100000);event=(version,'D'+str(rng.randrange(4)),'S'+str(rng.randrange(3)),rng.randrange(-1000,1001),bool(rng.randrange(2)))
 try:p.apply(c,key,*event)
 except ValueError:pass
 eq(p.reconcile(c),True,'random projection reconcile')
# Integer overflow is a rejected whole event, including its deduplication claim.
for initial,delta in [(2**63-1,1),(-(2**63),-1)]:
 c=connect();p.init(c);c.execute('INSERT INTO daily VALUES(?,?,?,?)',('D','S',1,initial));c.commit()
 try:p.apply(c,'overflow',1,'D','S',delta,True)
 except OverflowError:checks+=1
 else:raise AssertionError('aggregate overflow accepted')
 eq(c.execute('SELECT cents FROM daily').fetchone(),(initial,),'overflow unchanged')
 eq(c.execute('SELECT COUNT(*) FROM seen_fact').fetchone(),(0,),'overflow claim rollback')
c=connect();p.init(c);c.execute('BEGIN');c.execute("INSERT INTO daily VALUES('caller','S',0,0)")
try:p.apply(c,'other',1,'D','S',1,True)
except ValueError:checks+=1
else:raise AssertionError('caller transaction accepted')
eq(c.in_transaction,True,'caller transaction preserved');c.rollback()
for version in [0,-1,2**63,True]:
 try:p.apply(c,'bad',version,'D','S',1,True)
 except ValueError:checks+=1
 else:raise AssertionError('invalid version accepted')
if sys.version_info >= (3,12):
 c=sqlite3.connect(':memory:',autocommit=True);p.init(c)
 try:p.apply(c,'bad',1,'D','S',1,True)
 except ValueError:checks+=1
 else:raise AssertionError('autocommit=True accepted')
(ROOT/'build').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=ROOT/'build') as d:
 path=Path(d)/'durability-model.sqlite';c=sqlite3.connect(path);p.init(c);p.apply(c,'k',*versions[0]);c.close();c=sqlite3.connect(path);eq(p.reconcile(c),True,'close reopen committed model');c.close()
print(json.dumps({'status':'PASS','checks':checks,'python':sys.version,'sqlite':sqlite3.sqlite_version,'scope':'SQLite portable value/constraint and bounded after-image projection model','not_executed':['MySQL','Connector/J','H2','replication','CDC','network','real sharding','HA']},ensure_ascii=False))
