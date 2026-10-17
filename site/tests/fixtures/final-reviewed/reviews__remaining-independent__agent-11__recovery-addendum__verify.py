import json,hashlib,copy,re,math
from pathlib import Path
H=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def get(v,p):
 for k in p:v=v[k]
 return v
def put(v,p,a):
 for k in p[:-1]:v=v[k]
 v[p[-1]]=a
def walk(v,p=()):
 if isinstance(v,dict):
  for k,x in v.items():yield from walk(x,p+(k,))
 elif isinstance(v,list):
  for k,x in enumerate(v):yield from walk(x,p+(k,))
 else:yield p,v
def write(p,v):
 assert not p.exists(),p
 p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
expected={11:'5279332e320f628c8fb5a171a0ea7d7b3ed6fa31fb26814f61262d1e389b9f28',12:'2cf29974cf29494a39fc42b5dc69c33a44348283f19a80bc472aa70f86b7813b',13:'5ab86800c16ce0d257240ee40ee78a13aae828ff67e760e8c27d18e5979fb26f'}
source=Path('reviews/noteweave-project-verification'); sm=json.loads((source/'source-manifest.json').read_text());sr=[]
for r in sm['files']:
 if 'snapshot_file' not in r:sr.append(dict(path=r['path'],status='manifest-only bounded read; no full snapshot'));continue
 b=(source/r['snapshot_file']).read_bytes();assert b.endswith(b'\n'); raw=b[:-1]; assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==r['blob_sha'],r['path'];sr.append(dict(path=r['path'],blobSha=r['blob_sha'],snapshotSha256=H(b),status='pinned Git blob verified after removing exactly one extra saved terminal newline; snapshot unchanged'))
for n in (11,12,13):
 src=Path(f'reviews/final-document-review/agent-{n}');out=Path(f'reviews/remaining-independent/agent-{n}');add=out/'recovery-addendum'
 assert H((src/'frozen-manifest.json').read_bytes())==expected[n]
 fm=json.loads((src/'frozen-manifest.json').read_text())
 for row in fm['files']:assert H((src/row['path']).read_bytes())==row['sha256'],row
 old={f.name[:-10]:json.loads(f.read_text()) for f in src.glob('*-live.json')};staged={f.name[:-12]:json.loads(f.read_text()) for f in src.glob('*-staged.json')};final={f.name[:-14]:json.loads(f.read_text()) for f in out.glob('*-approved.json')};assert set(old)==set(staged)==set(final)
 replay=copy.deepcopy(old)
 for x in json.loads((src/'staged-leaf-replacements.json').read_text()):
  assert get(replay[x['entryId']],x['path'])==x['before'];assert H(x['before'])==x['beforeSha256'];assert H(x['after'])==x['afterSha256'];put(replay[x['entryId']],x['path'],x['after'])
 assert replay==staged
 replay=copy.deepcopy(old)
 for x in json.loads((src/'guarded-spans.json').read_text()):
  v=get(replay[x['entryId']],x['path']);assert not x['before'] or v.count(x['before'])==1;put(replay[x['entryId']],x['path'],v.replace(x['before'],x['after'],1) if x['before'] else v+x['after'])
 assert replay==staged
 for x in json.loads((out/'additional-composition.json').read_text()):
  v=get(replay[x['entryId']],x['path']);assert v.count(x['before'])==1;put(replay[x['entryId']],x['path'],v.replace(x['before'],x['after']))
 assert replay==final
 replay=copy.deepcopy(old);leaves=json.loads((out/'approved-leaves.json').read_text())
 for x in leaves:
  assert get(replay[x['entryId']],x['path'])==x['before'];assert H(x['before'])==x['beforeSha256'];assert H(x['after'])==x['afterSha256'];put(replay[x['entryId']],x['path'],x['after'])
 assert replay==final
 rows=[]
 for id,e in old.items():
  assert [p for p,v in walk(e)]==[p for p,v in walk(final[id])]
  for p,b in walk(e):
   a=get(final[id],p)
   if b!=a:assert p[-1] in ('a','lead','html','readingNotesHtml')
   if isinstance(b,str):
    for pat in (r'\bid="[^"]*"',r'<img\b[^>]*>',r'href="[^"]*"',r'<table\b.*?</table>',r'<code\b.*?</code>',r'<pre\b.*?</pre>'):
     assert re.findall(pat,b,re.S)==re.findall(pat,a,re.S),(id,p,pat)
  rows.append(dict(entryId=id,originalSha256=H((src/(id+'-live.json')).read_bytes()),approvedSha256=H((out/(id+'-approved.json')).read_bytes()),allFieldsEnumerated=True,questionsAndVariantsExact=True,codeTablesImagesLinksExact=True))
 dispositions=json.loads((out/'full-dispositions.json').read_text())
 expected_fields={(id,p) for id,e in old.items() for p,b in walk(e) if isinstance(b,str) and p[-1] in ('a','lead','html','readingNotesHtml','supplementHtml','sub')}
 assert {(x['entryId'],tuple(x['path'])) for x in dispositions}==expected_fields
 for x in dispositions:
  assert H(get(old[x['entryId']],x['path']))==x['beforeSha256'];assert H(get(final[x['entryId']],x['path']))==x['afterSha256']
 ret=json.loads((src/'retention-audit.json').read_text());saved=json.loads((out/'retention-check.json').read_text());assert len(ret)==saved['blocks']==len(saved['rows']);verbatim=0
 for x,y in zip(ret,saved['rows']):
  b=get(old[x['entryId']],x['path']);a=get(final[x['entryId']],x['path']);assert b[x['start']:x['end']]==x['text'];assert H(x['text'])==x['sha256'];status='verbatim-retained' if x['text'] in a else 'corrected-in-place';assert y['finalDisposition']==status;verbatim+=status=='verbatim-retained'
 render=json.loads((add/'built-render-audit.json').read_text());assert render['status']=='PASS';assert {x['entryId'] for x in render['rows']}==set(final)
 for x in render['rows']:assert H((add/(x['entryId']+'-rendered.html')).read_bytes())==x['sha256']
 live=[]
 for x in json.loads((src/'live-reconciliation.json').read_text()):
  data=json.loads((Path('site/notes-58c0-refactor/dist')/x['chunk']).read_text());matches=[]
  def scan(v):
   if isinstance(v,dict):
    if v.get('id')==x['entryId']:matches.append(v)
    for vv in v.values():scan(vv)
   elif isinstance(v,list):
    for vv in v:scan(vv)
  scan(data);assert len(matches)==1;live.append(dict(entryId=x['entryId'],chunk=x['chunk'],currentOriginalExact=matches[0]==old[x['entryId']]))
  assert matches[0]==old[x['entryId']],x['entryId']
 write(add/'verification.json',dict(status='PASS',authorManifestSha256=expected[n],authorFilesVerified=len(fm['files']),entries=rows,authorLeafAndSpanReplayExact=True,independentSpanReplayExact=True,originalBeforeGuardsReplayExact=True,fullDispositionsVerified=len(dispositions),retentionBlocks=len(ret),verbatimRetainedBlocks=verbatim,correctedBlocks=len(ret)-verbatim,liveReconciliation=live,rendererSha256=render['rendererSha256'],priorRenderSha256=json.loads((out/'built-render-audit.json').read_text())['rendererSha256']))
 write(add/'source-receipts.json',dict(noteweaveCommit=sm['commit'],factMatrixSha256=H((source/'FACT-MATRIX.md').read_bytes()),manifestSha256=H((source/'source-manifest.json').read_bytes()),sourceSnapshots=sr,authorPrimaryAuditSha256=H((src/('primary-source-audit.md' if n==13 else 'primary-source-audit.json')).read_bytes()),mcpFreshRead=dict(url='https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http',checked='2026-10-15T20:13:40Z',finding='Lines 66–67 distinguish absent core HTTP notifications and unspecified notification POST headers; request-only header qualification is supported.'),limits='Prior broader model/API receipts are retained historical review evidence, not newly fetched in recovery. No uninspected project tools/media/ACL or deployment inference.'))
 print(n,len(old),len(leaves),len(ret),verbatim,render['rendererSha256'])
