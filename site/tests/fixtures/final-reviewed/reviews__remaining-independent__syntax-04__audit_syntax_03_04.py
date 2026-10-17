import json,hashlib,re,html,copy,shutil
from pathlib import Path
R=Path('reviews/final-document-review');O=Path('reviews/remaining-independent');sha=lambda b:hashlib.sha256(b).hexdigest()
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
idx=json.loads((R/'syntax-03-04-review-index.json').read_text())
for b in ['03','04']:
 p=R/('syntax-'+b);o=O/('syntax-'+b);o.mkdir(exist_ok=True);assert not (o/'manifest.json').exists()
 spec=idx['batches'][b];assert sha((p/'manifest.json').read_bytes())==spec['manifestSha256'];m=json.loads((p/'manifest.json').read_text())
 for f,h in m['files'].items():assert sha((p/f).read_bytes())==h,f
 add=R/('syntax-'+b+'-runtime-addendum.json');assert sha(add.read_bytes())==spec['addendumSha256'];ad=json.loads(add.read_text())
 deps=[]
 for f,h in ad['files'].items():assert sha((R/f).read_bytes())==h,f;deps.append({'file':str(R/f),'sha256':h})
 orig=json.loads((p/'live-entries.json').read_text());staged=json.loads((p/'staged-entries.json').read_text());leaves=json.loads((p/'guarded-leaves.json').read_text());by={e['id']:e for e in copy.deepcopy(orig)}
 for l in leaves:
  assert l['path']==['html'];assert by[l['entryId']]['html']==l['before'];assert sha(l['before'].encode())==l['beforeSha256'];assert sha(l['after'].encode())==l['afterSha256'];s=l['before']
  for span in l['spans']:
   i=span['offset'];assert s[i:i+len(span['before'])]==span['before'];s=s[:i]+span['after']+s[i+len(span['before']):]
  assert s==l['after'];by[l['entryId']]['html']=s
 assert list(by.values())==staged
 receipts=[]
 for a,z in zip(orig,staged):
  assert {k:v for k,v in a.items() if k!='html'}=={k:v for k,v in z.items() if k!='html'}
  counts={}
  for tag in ['pre','table','img']:
   x=len(re.findall('<'+tag+r'\b',a['html']));y=len(re.findall('<'+tag+r'\b',z['html']));assert x==y;counts[tag]=y
  for attr in ['id','href','src']:assert set(re.findall(r'\b'+attr+'="([^"]+)"',a['html']))<=set(re.findall(r'\b'+attr+'="([^"]+)"',z['html']))
  code=[html.unescape(x) for x in re.findall(r'<pre[^>]*>(.*?)</pre>',z['html'],re.S)]
  if a['id'] in ['syntax-28','syntax-30','syntax-31','syntax-34']:
   c=next(x for x in code if 'class Main' in x or 'class Solution' in x);f=R/'syntax-03-04-tests'/a['id']/('Solution.java' if a['id']=='syntax-30' else 'Main.java');assert c==f.read_text()
  receipts.append({'entryId':a['id'],'allFieldsAndDecodedCodeRead':True,'originalSha256':sha(json.dumps(a,ensure_ascii=False,separators=(',',':')).encode()),'stagedSha256':sha(json.dumps(z,ensure_ascii=False,separators=(',',':')).encode()),'blocks':counts,'allMetadataAndSupplementsExact':True,'anchorsLinksImagesRetained':True})
 tests=json.loads((R/'syntax-03-04-test-results.json').read_text());assert len(tests['checks'])==17 and all(x['passed'] for x in tests['checks']);assert tests['checks'][-1]['output']=='22 API boundary checks passed\n'
 dump(o/'approved-alternative.json',leaves);dump(o/'composed-entries.json',staged);dump(o/'original-entries.json',orig)
 shutil.copyfile(p/'source-inventory.json',o/'original-source-inventory.json');shutil.copyfile(add,o/'runtime-addendum.json');shutil.copyfile(R/'syntax-03-04-test-results.json',o/'runtime-receipts.json')
 dump(o/'guard-retention-evidence.json',{'frozenManifestSha256':spec['manifestSha256'],'frozenAddendumSha256':spec['addendumSha256'],'everyManifestFileVerified':True,'sequentialSpanReplayExact':True,'originalBeforeCompositionExact':True,'entryCount':len(staged),'guardCount':len(leaves),'entries':receipts,'runtimeDependencies':deps,'limits':'No JVM run. Existing exact-code receipts and all harness source statically inspected. 17 records include 22 representative API checks, not all fragments, performance, concurrency stress or old-JDK proof.'})
 print('verified',b,len(staged),len(leaves))
