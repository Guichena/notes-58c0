"""Expected-only exact composition and read-only current541 validation."""
import copy,hashlib,json,pathlib,re
HERE=pathlib.Path(__file__).resolve().parents[2]/'tenth-low-coupling'
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from bridge import expected_entry,expected_canonical_hash,expected_registry,expected_file_hash
J=lambda p:json.loads(p.read_text());S=lambda x:hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest();canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def get(o,p):
 for k in p:o=o[k]
 return o
def setleaf(o,p,v):get(o,p[:-1])[p[-1]]=v
def key(r):return (r['entryId'],tuple(r['path']))
P=J(HERE/'transition-proof.json')
def validate_tenth_proof():
 p=P;R=p['records'];assert len(R)==len({key(r) for r in R})==14;assert len(p['originalEntries'])==len(p['finalEntries'])==9
 fwd=copy.deepcopy(p['originalEntries']);rev=copy.deepcopy(p['finalEntries'])
 for r in R:
  for side in ['before','after']:assert S(r[side])==r[side+'Sha256'],('record hash',key(r),side)
  assert get(fwd[r['entryId']],r['path'])==r['before'];setleaf(fwd[r['entryId']],r['path'],r['after'])
  assert get(rev[r['entryId']],r['path'])==r['after'];setleaf(rev[r['entryId']],r['path'],r['before'])
  source=J(HERE/'source-packages'/r['package']/pathlib.Path(r['sourceFile']).name)['records'][r['sourceIndex']]
  for k in ['entryId','path','before','after']:assert source[k]==r[k],('frozen original candidate field',key(r),k)
  if 'sequentialSegments' in r:
   text=r['before'];assert len(r['segments'])==len(r['sequentialSegments'])
   for s,original in zip(r['sequentialSegments'],r['segments']):
    assert s['before']==original['before'] and s['after']==original['after'];assert S(text)==s['beforeTextSha256'];assert text.count(s['before'])==1;assert text[s['beforeStart']:s['beforeEnd']]==s['before'];text=text[:s['beforeStart']]+s['after']+text[s['beforeEnd']:];assert S(text)==s['afterTextSha256']
   assert text==r['after']
  if 'exactSymbolTransition' in r:
   t=r['exactSymbolTransition'];assert r['before'].count(t['before'])==t['occurrences'];assert r['before'].replace(t['before'],t['after'])==r['after']
  if 'insertions' in r:
   text=r['before']
   for step in r['insertions']:
    assert S(text)==step['beforeTextSha256'];assert S(step['fragment'])==step['fragmentSha256'];i=step['position'];assert 0<=i<=len(text);text=text[:i]+step['fragment']+text[i:];assert S(text)==step['afterTextSha256']
   assert text==r['after']
  if 'bodySha256' in r:
   q=p['originalEntries'][r['entryId']]['items'][r['path'][1]];assert S(q['a'])==r['bodySha256'];assert q['q']==r['question'];assert q['a']==p['finalEntries'][r['entryId']]['items'][r['path'][1]]['a']
  assert re.findall(r'\bid=["\']([^"\']+)',r['before'])==re.findall(r'\bid=["\']([^"\']+)',r['after']),('stable HTML ids',key(r))
 assert fwd==p['finalEntries'] and rev==p['originalEntries']
 assert len(next(r for r in R if r['entryId']=='doc-18')['segments'])==4
 assert sum(len(r.get('insertions',[])) for r in R)==3
 for eid,e in p['originalEntries'].items():assert S(canon(e))==p['originalCanonicalHashes'][eid];assert S(canon(p['finalEntries'][eid]))==p['finalCanonicalHashes'][eid]
 assert len(p['originalEntryOrder'])==len(set(p['originalEntryOrder']))==len(p['finalEntryOrder'])==803;assert set(p['originalEntryOrder'])==set(p['finalEntryOrder'])==set(p['originalCanonicalHashes'])==set(p['finalCanonicalHashes'])
 for eid in p['originalCanonicalHashes']:
  if eid not in p['originalEntries']:assert p['originalCanonicalHashes'][eid]==p['finalCanonicalHashes'][eid]
 oldraw=(HERE/'original527-registry.json').read_bytes();assert S(oldraw)==p['registryBeforeSha256'];old=json.loads(oldraw);assert len(old['records'])==527;after=copy.deepcopy(old);seen={key(r) for r in after['records']}
 for r in R:
  assert key(r) not in seen;seen.add(key(r));after['records'].append({k:r[k] for k in ['entryId','path','before','after','beforeSha256','afterSha256','reason']})
 assert len(after['records'])==541;assert p['registryCompositions']==[];assert p['newRegistryKeys']==[{k:r[k] for k in ['entryId','path']} for r in R]
 for source,h in p['candidateSourceHashes'].items():
  parts=pathlib.PurePosixPath(source).parts;name=parts[1].removeprefix('integration-');target=HERE/'source-packages'/name/pathlib.Path(*parts[2:]);assert S(target.read_bytes())==h,('candidate source drift',source)
 for source,h in J(HERE/'review-evidence-pins.json').items():assert S((HERE/'review-evidence'/source).read_bytes())==h
 for relative,h in p['originalDocumentArchiveHashes'].items():assert S((HERE/relative).read_bytes())==h
 return p,old,after

def tenth_entry(old):
 if old['id'] not in P['originalEntries']:return expected_entry(copy.deepcopy(old))
 assert old==P['originalEntries'][old['id']],('entire original expected entry',old['id']);expected=copy.deepcopy(old)
 for r in P['records']:
  if r['entryId']==old['id']:assert get(expected,r['path'])==r['before'];setleaf(expected,r['path'],r['after'])
 assert expected==P['finalEntries'][old['id']];return expected_entry(expected)

def tenth_hash(eid,old):
 if eid not in P['originalEntries']:return expected_canonical_hash(eid,old)
 assert old==P['originalCanonicalHashes'][eid],('exact old expected canonical hash',eid);return expected_canonical_hash(eid,P['finalCanonicalHashes'][eid])
def tenth_order(old):assert old==P['originalEntryOrder'];return copy.deepcopy(P['finalEntryOrder'])
def assert_tenth_entries(entries):
 E={e['id']:e for e in entries};assert len(E)==len(entries)==803;assert [e['id'] for e in entries]==P['finalEntryOrder'],'complete current ordered traversal including DSL move'
 for eid,e in E.items():
  assert S(canon(e))==expected_canonical_hash(eid,P['finalCanonicalHashes'][eid]),('entire current entry hash',eid)
  if eid in P['finalEntries']:assert e==expected_entry(P['finalEntries'][eid]),('entire current tenth entry',eid)
 return E
def assert_tenth_registry(site):
 p,old,after=validate_tenth_proof();raw=(site/'content/final-audit-corrections.json').read_bytes();assert S(raw)==expected_file_hash('content/final-audit-corrections.json',p['registryAfterSha256']),'current541 raw registry required';assert json.loads(raw)==expected_registry(after),'complete current541 registry required';return expected_registry(after)

def assert_tenth_site(site):
 entries=[]
 for f in sorted((site/'dist/data/chapters').glob('*.json')):entries.extend(J(f)['entries'])
 E=assert_tenth_entries(entries);assert_tenth_registry(site);c=J(HERE/'catalog-proof.json');actual=J(site/'dist/data/catalog.json');assert actual==c['after'],'complete current catalog must equal expected, including unchanged HL and catalog order'
 assert S((site/'content/final-audit-comparison-review.json').read_bytes())==c['comparisonReviewSha256']
 for row in c['questionIdentities']:
  q=E[row['entryId']]['items'][row['index']];assert q.get('id')==row['questionId'];assert q['q']==row['question'];assert row['entryId']+'#'+str(row['index']) not in actual['HL']['cards']
 for relative,h in {**P['frozenPriorFixtureHashes'],**P['frozenArchiveHashes']}.items():assert S((site/relative).read_bytes())==h,('immutable original evidence/archive',relative)
 return E
