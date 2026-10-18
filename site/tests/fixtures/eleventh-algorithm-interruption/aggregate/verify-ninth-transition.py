#!/usr/bin/env python3
"""Portable read-only verifier. Actual acceptance never uses a synthesized dist."""
import argparse,copy,hashlib,json,pathlib,re,sys
TENTH=pathlib.Path(__file__).resolve().parents[2]/'tenth-low-coupling'
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from tenth_expected import validate_tenth_proof,tenth_entry,tenth_hash,tenth_order,assert_tenth_entries,assert_tenth_registry,expected_registry,expected_file_hash
TP,TOLD,TAFTER=validate_tenth_proof()
HERE=TENTH.parent/'ninth-small-repairs'
J=lambda p:json.loads(p.read_text());S=lambda x:hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest();canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def get(o,p):
 for k in p:o=o[k]
 return o
def setleaf(o,p,v):get(o,p[:-1])[p[-1]]=v
def key(r):return (r['entryId'],tuple(r['path']))
def validate_proof():
 p=J(HERE/'transition-proof.json');R=p['records'];assert len(R)==31 and len({key(r) for r in R})==31
 narrow=[r for r in R if r['mode']=='exact-segments'];assert len(narrow)==27 and sum(len(r['segments']) for r in narrow)==51
 for r in R:
  for side in ['before','after']:assert S(r[side])==r[side+'Sha256'],('record hash',key(r),side)
  assert get(p['originalEntries'][r['entryId']],r['path'])==r['before'];assert get(p['finalEntries'][r['entryId']],r['path'])==r['after']
 for r in narrow:
  result=r['before'];spans=sorted(r['segments'],key=lambda e:e['beforeStart']);last=0;reconstructed=''
  for s in r['segments']:
   assert result.count(s['before'])==1 and r['before'].count(s['before'])==1
   assert S(s['before'])==s['beforeSha256'] and S(s['after'])==s['afterSha256'];result=result.replace(s['before'],s['after'],1)
  for s in spans:
   assert last<=s['beforeStart']<s['beforeEnd'];assert r['before'][s['beforeStart']:s['beforeEnd']]==s['before'];reconstructed+=r['before'][last:s['beforeStart']]+s['after'];last=s['beforeEnd']
  reconstructed+=r['before'][last:];assert result==reconstructed==r['after']
  if 'sourceFile' in r:
   source=J(HERE/p['sourceCopies'][r['sourceFile']])['records'][r['sourceIndex']];assert S(source['before'])==r['proposalBeforeSha256'];assert [{'before':s['before'],'after':s['after']} for s in r['segments']]==source['segments']
 for src,dest in p['sourceCopies'].items():assert S((HERE/dest).read_bytes())==p['candidateSourceHashes'][src]
 # Complete reverse objects detect any unreviewed identity, question, lead, field or sibling changes.
 fwd=copy.deepcopy(p['originalEntries']);rev=copy.deepcopy(p['finalEntries'])
 for r in R:assert get(fwd[r['entryId']],r['path'])==r['before'];setleaf(fwd[r['entryId']],r['path'],r['after'])
 for r in reversed(R):assert get(rev[r['entryId']],r['path'])==r['after'];setleaf(rev[r['entryId']],r['path'],r['before'])
 assert fwd==p['finalEntries'] and rev==p['originalEntries']
 for row in J(HERE/'preservation-proof.json')['records']:
  r=next(r for r in R if key(r)==key(row))
  for s in row['untouchedSpans']:
   a=r['before'][s['beforeStart']:s['beforeEnd']];b=r['after'][s['afterStart']:s['afterEnd']];assert a==b and S(a)==s['sha256']
  for b in row['unchangedCompleteBlocks']:
   assert r['before'][b['beforeStart']:b['beforeEnd']]==b['html'];assert S(b['html'])==b['sha256'];assert r['after'].count(b['html'])>=r['before'].count(b['html'])
  assert re.findall(r'\bid=["\']([^"\']+)',r['before'])==row['elementIds']==re.findall(r'\bid=["\']([^"\']+)',r['after'])
 # Eighth batch appended text must survive exactly; older whole-leaf candidates cannot replace it.
 special=next(r for r in R if key(r)==('ai-agent-9',('items',7,'a')));source=J(HERE/p['sourceCopies'][special['sourceFile']])['records'][special['sourceIndex']]
 assert special['before'].startswith(source['before']);tail=special['before'][len(source['before']):];assert tail and special['after'].endswith(tail)
 # Approved lead replacements are separate; no inferred duplicate body insertion.
 for eid,i in [('ai-rag-5',4),('ai-上下文工程-3',4)]:
  old=p['originalEntries'][eid]['items'][i];new=p['finalEntries'][eid]['items'][i];assert old['lead'] not in old['a'];assert new['lead'] not in new['a'];assert old['lead']!=new['lead']
 old=J(HERE/'original500-registry.json');assert S((HERE/'original500-registry.json').read_bytes())==p['registryBeforeSha256'];assert len(old['records'])==500
 after=copy.deepcopy(old);by={key(r):r for r in after['records']};overlap=[];newkeys=[]
 for r in R:
  if key(r) in by:
   prev=by[key(r)];assert prev['after']==r['before'] and prev['afterSha256']==r['beforeSha256'];before=copy.deepcopy(prev);prev['after']=r['after'];prev['afterSha256']=r['afterSha256'];overlap.append(dict(entryId=r['entryId'],path=r['path'],before=before,after=copy.deepcopy(prev)))
  else:
   nr={k:r[k] for k in ['entryId','path','before','after','beforeSha256','afterSha256','reason']};after['records'].append(nr);by[key(r)]=nr;newkeys.append(dict(entryId=r['entryId'],path=r['path']))
 assert overlap==p['registryCompositions'] and newkeys==p['newRegistryKeys'];assert len(after['records'])==527
 return p,old,after

def assert_affected(p,by,mode):
 expected=p['originalEntries' if mode=='before' else 'finalEntries']
 for eid,e in expected.items():assert by[eid]==(tenth_entry(e) if mode=='after' else e),('whole current entry mismatch',eid,mode)

def assert_entries(p,entries,mode):
 by={e['id']:e for e in entries};assert len(by)==len(entries)==803;assert [e['id'] for e in entries]==(tenth_order(p['entryOrder']) if mode=='after' else p['entryOrder'])
 expected=p['originalEntries' if mode=='before' else 'finalEntries'];assert_affected(p,by,mode)
 for eid,e in by.items():
  if eid in expected:assert e==(tenth_entry(expected[eid]) if mode=='after' else expected[eid]),('whole current entry mismatch',eid,mode)
  else:assert S(canon(e))==(tenth_hash(eid,p['originalCanonicalHashes'][eid]) if mode=='after' else p['originalCanonicalHashes'][eid]),('unrelated entire entry changed',eid)
 return by

def assert_metadata(p,entries,catalog,mode):
 m=J(HERE/'metadata-contracts.json');by={e['id']:e for e in catalog['entries']};expected=m['catalogBefore' if mode=='before' else 'catalogAfter'];assert S(canon(catalog['HL']['cards']))==m['cardsSha256']
 for eid,e in expected.items():assert by[eid]==e,('catalog identity/title drift',eid)
 for row in m['questions']:
  eid,i=row['key'].rsplit('#',1);q=entries[eid]['items'][int(i)];assert q.get('id')==row['questionId'] and q['q']==row['questionText'];assert row['key'] not in catalog['HL']['cards'];assert S(q.get('lead',''))==row['leadBeforeSha256' if mode=='before' else 'leadAfterSha256'];assert S(q['a'])==row['bodyBeforeSha256' if mode=='before' else 'bodyAfterSha256']
 for eid in ['own-practice-banana-transfer','own-practice-water-bfs']:
  e=entries[eid];assert '<h2 class="md-h md-h2">'+e['title']+'</h2>' in e['items'][0]['a']

ap=argparse.ArgumentParser();ap.add_argument('--site',type=pathlib.Path);ap.add_argument('--mode',choices=['before','after'],default='after');ap.add_argument('--check-fixtures',action='store_true');args=ap.parse_args()
p,old,after=validate_proof();negatives=[]
# Pure-object negative self-tests: reject restoring old text, metadata drift and independent-condition loss.
if args.check_fixtures:
 expected=p['finalEntries'];
 for label,eid,path in [('stale-whole-leaf','ai-agent-9',['items',7,'a']),('unreviewed-title','ai-rag-5',['title']),('lost-framework-condition','own-os-sandbox',['items',1,'a']),('unreviewed-sibling','ai-agent-9',['items',7,'q'])]:
  bad=copy.deepcopy(expected);v=get(bad[eid],path)
  if label=='stale-whole-leaf':
   r=next(r for r in p['records'] if key(r)==(eid,tuple(path)));source=J(HERE/p['sourceCopies'][r['sourceFile']])['records'][r['sourceIndex']];setleaf(bad[eid],path,source['after'])
  elif label=='lost-framework-condition':
   ws=J(HERE.parent/'framework-adapter-cleanup/evidence-witnesses.json')['witnesses'];w=next(w for w in ws if w['key']=='own-os-sandbox#1:b10');assert w['html'] in v;setleaf(bad[eid],path,v.replace(w['html'],'',1))
  else:setleaf(bad[eid],path,v+' BROKEN')
  try:assert_affected(p,bad,'after')
  except AssertionError:negatives.append(label)
  else:raise AssertionError(('negative accepted',label))
 print(json.dumps(dict(status='passed',scope='candidate fixtures only',fields=31,narrowSegments=51,frameworkFields=4,entries=21,registryBefore=500,registryAfter=527,negativeSelfChecks=negatives,actualAcceptance=False,siteWrites=0)));sys.exit(0)
assert args.site is not None,'--site is required; no fallback or generated preview is accepted'
site=args.site.resolve();entries=[]
for file in sorted((site/'dist/data/chapters').glob('*.json')):entries.extend(J(file)['entries'])
actual=assert_entries(p,entries,args.mode);assert_metadata(p,actual,J(site/'dist/data/catalog.json'),args.mode)
if args.mode=='after':assert_tenth_entries(entries);assert_tenth_registry(site)
assert after==TOLD,'historical ninth527 equals exact tenth before reference'
assert J(site/'content/final-audit-corrections.json')==(old if args.mode=='before' else expected_registry(TAFTER)),'entire registry differs from exact reconstruction'
assert S((site/'content/final-audit-corrections.json').read_bytes())==(p['registryBeforeSha256'] if args.mode=='before' else expected_file_hash('content/final-audit-corrections.json',TP['registryAfterSha256']))
m=J(HERE/'metadata-contracts.json');assert S((site/'content/final-audit-comparison-review.json').read_bytes())==m['comparisonReviewRegistrySha256']
for rel,h in p['frozenPriorFixtureHashes'].items():assert S((site/rel).read_bytes())==h,('frozen prior fixture changed',rel)
print(json.dumps(dict(status='PASS_SUPPLIED_JOINT_SITE_INPUTS' if args.mode=='after' else 'PASS_SUPPLIED_HISTORICAL_SITE_INPUTS',mode=args.mode,site=str(site),fields=31,entries=21,corpusEntries=803,registryRecords=500 if args.mode=='before' else 527,historicalStageRegistryRecords=500 if args.mode=='before' else 541,currentRegistryRecords=500 if args.mode=='before' else 558,historicalRegistryLabel='registryRecords is original ninth stage; historical tenth541 and supplied current558 are separately gated',validatedSuppliedSiteInputs=True,frozenPriorFixtures=len(p['frozenPriorFixtureHashes']),actualAcceptance=False,siteWrites=0)))
