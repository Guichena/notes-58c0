"""Exact interruption-observation expected-side adapter; actual Java is never rewritten."""
import hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
PROOF_BYTES=(HERE/'transition-proof.json').read_bytes()
assert hashlib.sha256(PROOF_BYTES).hexdigest()=='049585793a2a5878490447ee5775e566e33b6015ff3ab2239f8ce40e7b960736','exact interruption proof required'
PROOF=json.loads(PROOF_BYTES)
sha=lambda x:hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
for r in PROOF['records']:
 assert sha(r['before'])==r['beforeSha256'] and sha(r['after'])==r['afterSha256']
assert len(PROOF['records'])==2 and len(PROOF['sources'])==4

def expected_leaf_hash(entry_id,path,old):
 rows=[r for r in PROOF['records'] if r['entryId']==entry_id and r['path']==path and r['beforeSha256']==old]
 assert len(rows)<=1
 return rows[0]['afterSha256'] if rows else old

def expected_source_hash(name,old):
 rows=[r for r in PROOF['sources'] if r['class']+'.java'==name and r['beforeSha256']==old]
 assert len(rows)<=1
 return rows[0]['afterSha256'] if rows else old

def run_original(key,expected):
 original=HERE.parents[2]/key
 raw=original.read_bytes()
 assert sha(raw)==PROOF['originalConsumers'][key]['sha256'],'immutable original consumer changed: '+key
 code=raw.decode()
 for edit in expected:
  assert code.count(edit['before'])==1,(key,'non-unique bridge edit')
  code=code.replace(edit['before'],edit['after'],1)
 ns={'__name__':'__main__','__file__':str(original),'interruption_expected_leaf_hash':expected_leaf_hash,'interruption_expected_source_hash':expected_source_hash}
 exec(compile(code,str(original),'exec'),ns)

def expected_entry(old):
 import copy
 result=copy.deepcopy(old)
 for r in PROOF['records']:
  if r['entryId']==old['id']:
   value=result
   for k in r['path'][:-1]:value=value[k]
   assert value[r['path'][-1]]==r['before'],'exact entire prior expected leaf required'
   value[r['path'][-1]]=r['after']
 return result

def expected_canonical_hash(entry_id,old):
 if entry_id not in PROOF['beforeEntries']:return old
 canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
 assert old==sha(canon(PROOF['beforeEntries'][entry_id])),'exact prior entire-entry canonical hash required'
 return sha(canon(PROOF['afterEntries'][entry_id]))

def expected_registry(prior):
 import copy
 result=copy.deepcopy(prior)
 for row in PROOF['registryRecords']:
  matches=[i for i,r in enumerate(result['records']) if r['entryId']==row['before']['entryId'] and r['path']==row['before']['path']]
  assert len(matches)==1
  i=matches[0];assert result['records'][i]==row['before'],'exact entire prior registry row required'
  result['records'][i]=copy.deepcopy(row['after'])
 assert len(result['records'])==len(prior['records'])
 return result
