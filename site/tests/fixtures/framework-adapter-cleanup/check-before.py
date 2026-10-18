#!/usr/bin/env python3
import argparse,importlib.util,json,pathlib,hashlib
O=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('verify_adapter',O/'verify-final-dist.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--dist',required=True,type=pathlib.Path);a=p.parse_args();R,P,V,W,D,I,N=m.fixture_review();E,C=m.load_dist(a.dist)
for r in R:
 x=m.item(E,r['entryId'],r['itemIndex']);m.need(x['a']==r['before'],'STALE_BEFORE '+r['entryId']+'/'+str(r['itemIndex']));m.need(x['q']==r['questionGuard']and x.get('id')==r['questionId'],'STALE_QUESTION')
c=m.check_witnesses(E,W,only_existing=True)
print(json.dumps({'status':'PASS_EXACT_369_BEFORE_AND_EXISTING_WITNESSES','guardedLeaves':len(R),'existingWitnesses':c,'newWitnessesPending':len(W)-c,'actualFinalAcceptance':False,'siteWrites':0}))
