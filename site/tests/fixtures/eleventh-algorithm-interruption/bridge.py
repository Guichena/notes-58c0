"""Strict expected-side joint 541 -> 558 bridge. No actual input is rewritten."""
import copy,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
S=lambda x:hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
raw=(HERE/'joint-proof.json').read_bytes();assert S(raw)=='0df8a71700b464299001989104676992fdda9a454b038de19c7b171c0c2c96a0';P=json.loads(raw)
for relative,h in P['componentPins'].items():assert S((HERE.parent/relative).read_bytes())==h,('component input',relative)
def expected_entry(old):
 eid=old['id']
 if eid not in P['beforeEntries']:return copy.deepcopy(old)
 assert old==P['beforeEntries'][eid],('exact entire541 expected entry',eid)
 result=copy.deepcopy(old)
 for r in P['records']:
  if r['entryId']!=eid:continue
  v=result
  for k in r['path'][:-1]:v=v[k]
  assert v[r['path'][-1]]==r['before'];v[r['path'][-1]]=r['after']
 assert result==P['afterEntries'][eid];return result

def expected_canonical_hash(eid,old):
 if eid not in P['beforeEntries']:return old
 assert old==P['beforeCanonicalHashes'][eid],('exact entire541 canonical expected hash',eid)
 return P['afterCanonicalHashes'][eid]

def expected_registry(old):
 assert len(old['records'])==541 and S(canon(old))==P['registryBeforeCanonicalSha256'],'complete exact541 expected registry'
 result=copy.deepcopy(old)
 for row in P['registryCompositions']:
  assert result['records'][row['index']]==row['before'];result['records'][row['index']]=copy.deepcopy(row['after'])
 seen={(r['entryId'],tuple(r['path'])) for r in result['records']}
 for row in P['algorithmNewRegistryRecords']:
  key=(row['entryId'],tuple(row['path']));assert key not in seen;seen.add(key);result['records'].append(copy.deepcopy(row))
 assert len(result['records'])==558 and S(canon(result))==P['registryAfterCanonicalSha256'];return result
_SOURCES=None
def expected_file_hash(path,old):
 global _SOURCES
 if _SOURCES is None:
  raw=(HERE/'source-transitions.json').read_bytes();assert S(raw)==P['sourceProofSha256'];_SOURCES=json.loads(raw)
 rows=[r for r in _SOURCES['replacements']+_SOURCES['assets'] if r['target']==path]
 assert len(rows)<=1
 if not rows:return old
 assert old==rows[0]['beforeSha256'],('exact541 source hash',path)
 return rows[0]['afterSha256']
