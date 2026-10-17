from pathlib import Path
import json,hashlib,re,html
sha=lambda b:hashlib.sha256(b).hexdigest()
for b in ['03','04']:
 d=Path('reviews/final-document-review/handwrite-'+b);p=Path('reviews/remaining-independent/handwrite-'+b);es={e['id']:e for e in json.load(open(d/'staged-entries.json'))};rows=[]
 for r in json.load(open(d/'java-inventory.json')):
  f=d/'java'/r['file'];cs=[html.unescape(x) for x in re.findall(r'<pre\b[^>]*>(.*?)</pre>',es[r['entryId']][r['field']],re.S)];matches=[i for i,x in enumerate(cs) if x.strip()==f.read_text().strip()];assert len(matches)==1,r;assert sha(f.read_bytes())==r['sha256'],r
  rows.append(dict(**r,actualStagedIndex=matches[0],stagedCodeMatchesCompiledSource=True))
 logs=[]
 for f in d.glob('*output.log'):logs.append(dict(path=str(f),sha256=sha(f.read_bytes()),contents=f.read_text()))
 receipt={'mode':'independent static receipt and source identity verification; no test/source runner executed','javaSources':rows,'inventoryCorrection':'Four handwrite60 indices in frozen inventory predate two-block consolidation: MinuteHourLimiter4, MinuteHourLimiterTest5, RateLimitLab6, LeakyBucketLab7. Exact source matches and hashes verified; frozen inventory remains unchanged.','runner':{'path':str(d/'test-runner.sh'),'sha256':sha((d/'test-runner.sh').read_bytes()),'inspected':True,'heap':'128MB','perMainTimeout':'40 seconds','serialLock':'/tmp/notes-review-java.lock'},'logs':logs,'scope':'Author test output is not a new independent runtime run. Java21 standard-library models and local journal reopen only. External Redis/Spring adapters excluded; H2/JDBC classes compile-only. SQL28 Python is independent mathematical modeling, not SQL execution. Controlled JS fakes are not a browser or Worker integration.'}
 (p/'test-receipts.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)); print(b,'source identities',len(rows))
dist=Path('site/notes-58c0-refactor/dist');cat=json.load(open(dist/'data/catalog.json'));es={}
for c in {e['_chunk'] for e in cat['entries']}:
 for e in json.load(open(dist/c))['entries']:es[e['id']]=e
for b in ['01','02','03','04']:
 q=Path('reviews/remaining-independent/handwrite-'+b+'/approved-alternative.json')
 if q.exists():
  for r in json.load(open(q))['patches']:es[r['entryId']][r['path']]=r['replacement']
checks=[]
for id,needles in [('207',['class CoursePlan']),('handwrite-57',['function mapLimit','function runDag']),('database-73',['CREATE TABLE students','CREATE TABLE courses']),('155',['class InterviewCaches'])]:
 blocks=[html.unescape(x) for v in es[id].values() if isinstance(v,str) for x in re.findall(r'<pre\b[^>]*>(.*?)</pre>',v,re.S)]
 for n in needles:
  matches=[x for x in blocks if n in x];assert matches,(id,n);checks.append(dict(entryId=id,requiredBody=n,codeSha256=[sha(x.encode()) for x in matches]))
Path('reviews/remaining-independent/handwrite-04/dependency-body-audit.json').write_text(json.dumps(checks,indent=2));print('dependency bodies verified')
