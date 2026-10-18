"""Read-only guarded leaf verification; accepts baseline or an integrated actual dist."""
import argparse,json,pathlib,hashlib,copy
P=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--site',type=pathlib.Path,required=True);p.add_argument('--expect-after',action='store_true');a=p.parse_args()
R=json.load(open(P/'records.json'))['records'];E={e['id']:e for f in (a.site/'dist/data/chapters').glob('*.json') for e in json.load(open(f))['entries']}
sha=lambda s:hashlib.sha256(s.encode()).hexdigest();mode='after' if a.expect_after else 'before';seen=set()
for r in R:
 k=(r['entryId'],tuple(r['path']));assert k not in seen;seen.add(k)
 assert (P/r['originalBytes']).read_bytes()==r['before'].encode(),('original bytes drift',k)
 for v in ['before','after']:assert sha(r[v])==r[v+'Sha256'],('hash drift',k,v)
 v=E[r['entryId']]
 for x in r['path']:v=v[x]
 assert v==r[mode],('guard mismatch',mode,k)
print(f'PASS {len(R)} exact {mode} leaves and original raw bytes; verifier makes no site writes.')
