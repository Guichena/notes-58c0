#!/usr/bin/env python3
"""Read only explicit final dist; compile only code extracted from it. No before->after synthesis here."""
import argparse,pathlib,json,re,html,hashlib,subprocess,shutil,tempfile,datetime,sqlite3,zipfile,collections,os
P=pathlib.Path(__file__).resolve().parent
sha=lambda x:hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def java_command():
 j=str(pathlib.Path(os.environ['JAVA_HOME'])/'bin/java') if os.environ.get('JAVA_HOME') else shutil.which('java')
 if not j:raise RuntimeError('JDK required; Java checks not run')
 return j
def blocks(text):
 return [html.unescape(re.sub(r'^\s*<code[^>]*>|</code>\s*$','',m)) for m in re.findall(r'<pre\b[^>]*>(.*?)</pre>',text,re.S)]
def get(e,p):
 for k in p:e=e[k]
 return e
def method(code,start):
 i=code.index(start);brace=code.index('{',i);level=1;j=brace+1
 while level:
  level+=(code[j]=='{')-(code[j]=='}');j+=1
 return code[i:j]
def sql_oracle(sql):
 # MySQL 8 expression semantics used: UTC->fixed +08 day, DATEDIFF and / floating numerator.
 # SQLite is ONLY an execution vehicle with explicit date UDFs; this is not a MySQL connection.
 assert "SET time_zone = '+00:00'" in sql and "'+08:00'" in sql
 assert 'history_days' in sql and 'NULLIF' in sql
 cleaned=re.sub(r'--[^\n]*','',sql)
 cleaned=re.sub(r"SET\s+time_zone\s*=\s*'\+00:00'\s*;",'',cleaned,flags=re.I)
 cleaned=re.sub(r"CAST\('2026-10-17' AS DATE\)","'2026-10-17'",cleaned)
 db=sqlite3.connect(':memory:');db.execute('CREATE TABLE login_log(user_id INTEGER, login_time TEXT)')
 db.create_function('CONVERT_TZ',3,lambda t,a,b:(datetime.datetime.fromisoformat(t)+datetime.timedelta(hours=8)).isoformat(' ') if t else None)
 db.create_function('DATEDIFF',2,lambda a,b:(datetime.date.fromisoformat(a)-datetime.date.fromisoformat(b)).days if a and b else None)
 # Repeated logins, exact D7 boundary, immature cohorts, observation-day cohort, UTC crossing,
 # future activity excluded, and old users whose late activity must never become new signups.
 rows=[(1,'2026-10-09 16:00:00'),(1,'2026-10-10 16:00:00'),(1,'2026-10-16 16:00:00'),(1,'2026-10-16 16:00:00'),
       (2,'2026-10-10 01:00:00'),(2,'2026-10-17 16:00:00'),(3,'2026-10-15 02:00:00'),(3,'2026-10-16 02:00:00'),(3,'2026-10-22 02:00:00'),
       (4,'2026-10-16 17:00:00'),(4,'2026-10-17 17:00:00'),(5,'2020-01-01 00:00:00'),(5,'2026-10-10 00:00:00'),
       (6,'2026-10-17 15:59:59'),(7,'2026-10-17 16:00:00'),(8,'2026-10-08 23:59:59'),(8,'2026-10-15 23:59:59'),
       (9,'2026-10-16 00:00:00'),(10,None),(None,'2026-10-10 00:00:00')]
 # Deterministic generated user histories extend sample with varied cohort maturities.
 import random
 rng=random.Random(126601)
 for user in range(20,220):
  first=datetime.datetime(2026,9,1)+datetime.timedelta(hours=rng.randrange(24*50))
  for day in {0,*[rng.randrange(12) for _ in range(6)]}:
   value=(first+datetime.timedelta(days=day)).isoformat(' ');rows.append((user,value))
 db.executemany('INSERT INTO login_log VALUES (?,?)',rows)
 histories=collections.defaultdict(set)
 for user,t in rows:
  if user is not None and t is not None:histories[user].add((datetime.datetime.fromisoformat(t)+datetime.timedelta(hours=8)).date())
 cutoff=datetime.date(2026,10,17);cohorts=collections.defaultdict(list)
 for days in histories.values():
  first=min(days)
  if first<=cutoff:cohorts[first].append(days)
 expected=[]
 for first,users in sorted(cohorts.items(),reverse=True):
  eligible=[len(users) if first+datetime.timedelta(days=n)<=cutoff else 0 for n in (1,7)]
  rates=[sum(first+datetime.timedelta(days=n) in days for days in users)/eligible[i] if eligible[i] else None for i,n in enumerate((1,7))]
  expected.append((first.isoformat(),len(users),*eligible,*rates))
 actual=db.execute(cleaned).fetchall();assert actual==expected,(actual,expected)
 # User3's cohort can include generated users, but still D7-ineligible exactly like all recent cohorts.
 row=next(r for r in actual if r[0]=='2026-10-15');assert row[3]==0 and row[5] is None
 assert next(r for r in actual if r[0]=='2026-10-17')[2:]==(0,0,None,None)
 db.execute('DELETE FROM login_log');assert db.execute(cleaned).fetchall()==[]
 return {'engine':'SQLite + explicit MySQL-date-compatible UDFs','liveMySQL':False,'inputRows':len(rows),'cohorts':len(expected),'checks':'full independent relation oracle, exact maturity/day boundary, duplicates, future activity, empty input'}
def verify(dist,fixtures):
 dist=pathlib.Path(dist).resolve();fixtures=pathlib.Path(fixtures).resolve()
 entries={e['id']:e for p in (dist/'data/chapters').glob('*.json') for e in json.loads(p.read_text())['entries']}
 catalog=json.loads((dist/'data/catalog.json').read_text());routes={e['id'] for e in catalog['entries']}
 records=json.loads((fixtures/'records.json').read_text())['records']
 assert len(records)==7
 for r in records:
  assert r['entryId'] in routes
  assert sha(r['before'])==r['beforeSha256'] and sha(r['after'])==r['afterSha256']
  assert sha(get(entries[r['entryId']],r['path']))==r['afterSha256'],('unapplied/dist drift',r['entryId'],r['path'])
 sources={}
 for eid,key,names in [('hw-json-operations','answerHtml',['JsonOperations']),('handwrite-56','supplementHtml',['CloseableRing','ConditionQueue','MonitorStack','Checks']),('hw-concurrency-ticket-parking','answerHtml',['TicketParking'])]:
  for name in names:
   found=[b for b in blocks(entries[eid][key]) if re.search(r'\bclass '+name+r'\b',b)];assert len(found)==1,(eid,name,len(found));sources[name+'.java']=found[0]
 ring=(dist/'assets/examples/agent-backend-ring/CloseableRing.java').read_text();assert ring==sources['CloseableRing.java'],'served Java differs from page'
 with zipfile.ZipFile(dist/'assets/examples/agent-backend-ring/closeable-ring-contract.zip') as z:assert z.read('CloseableRing.java').decode()==ring,'zip Java differs from page'
 shard=entries['pattern-transaction-ha']['codeSkeletons']['snippets'][2]['code'];sources['ShardingRouter.java']=method(shard,'public class ShardingRouter')
 getorder=method(shard,'public Order getOrder(')
 sources['ShardingOracle.java']='''import java.util.*;
public class ShardingOracle {
 static record Order(String db,String sql,long user,long order){}
 static class Jdbc { final String db;Jdbc(String db){this.db=db;}Order query(String sql,long u,long o){return new Order(db,sql,u,o);} }
 final ShardingRouter router=new ShardingRouter();final Jdbc jdbc=new Jdbc("WRONG_DEFAULT");
 Jdbc jdbcFor(String db){if(!db.matches("db_(?:[0-9]|1[0-5])"))throw new AssertionError("unsafe db");return new Jdbc(db);}
 '''+getorder+'''
 public static void main(String[] args){ShardingOracle x=new ShardingOracle();Set<String> pairs=new HashSet<>();
 for(long user=1;user<=4096;user++){Order r=x.getOrder(user,123);String db="db_"+(user%16),table="orders_"+((user/16)%16);if(!r.db.equals(db)||!r.sql.equals("SELECT * FROM "+table+" WHERE user_id=? AND order_id=?")||r.user!=user||r.order!=123)throw new AssertionError("wrong routed adapter "+user);pairs.add(db+"/"+table);}
 if(pairs.size()!=256)throw new AssertionError("unreachable shard");
 for(long bad:new long[]{0,-1,Long.MIN_VALUE})try{x.getOrder(bad,1);throw new AssertionError("invalid user");}catch(IllegalArgumentException expected){}
 if(!x.getOrder(Long.MAX_VALUE,1).db.equals("db_15"))throw new AssertionError("large id");
 System.out.println("ShardingOracle PASS 4096 adapter-spy routes, all256 physical pairs; no database connection");}}
'''
 java=java_command();logs=[]
 with tempfile.TemporaryDirectory(prefix='remaining-practice-dist-') as tmp:
  t=pathlib.Path(tmp)
  for name,body in sources.items():(t/name).write_text(body)
  shutil.copyfile(fixtures/'JsonBudgetOracle.java',t/'JsonBudgetOracle.java')
  # Historical contract is retained byte-for-byte and exercises the new actual source too.
  shutil.copyfile(fixtures/'RingContractTest.java',t/'RingContractTest.java')
  command=[java,'-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',str(t),*map(str,t.glob('*.java'))]
  subprocess.run(command,check=True,capture_output=True,text=True,timeout=45)
  for cls in ['JsonOperations','JsonBudgetOracle','CloseableRing','ConditionQueue','MonitorStack','TicketParking','ShardingOracle','RingContractTest']:
   r=subprocess.run([java,'-cp',str(t),cls],check=True,capture_output=True,text=True,timeout=30);logs.append(r.stdout.strip())
 sql=sql_oracle(entries['pattern-sql-query']['codeSkeletons']['snippets'][2]['code'])
 return {'status':'PASS_EXPLICIT_DIST_ONLY','dist':str(dist),'guardedLeaves':7,'entries':5,'java':logs,'sql':sql,'productionCode':'extracted exclusively from supplied dist; fixtures contain independent tests only'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--dist',required=True);p.add_argument('--fixtures',default=str(P));a=p.parse_args()
 print(json.dumps(verify(a.dist,a.fixtures),ensure_ascii=False,indent=2))
