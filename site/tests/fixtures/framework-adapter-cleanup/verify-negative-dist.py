#!/usr/bin/env python3
"""Mutate only in-memory copies of actual dist for independent existing-witness negatives."""
import argparse,copy,hashlib,importlib.util,json,pathlib
O=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('verify_adapter',O/'verify-final-dist.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--dist',required=True,type=pathlib.Path);a=p.parse_args();E,C=m.load_dist(a.dist);R,P,V,W,D,I,N=m.fixture_review();existing=[w for w in W if w['origin']=='existing369'];m.check_witnesses(E,existing)
files=list((a.dist/'data/chapters').glob('*.json'))+[a.dist/'data/catalog.json'];before={str(f):hashlib.sha256(f.read_bytes()).hexdigest()for f in files};cases=[]
def negative(name,key,operation):
 w=next(x for x in existing if x['key']==key);X=copy.deepcopy(E);operation(X,w)
 try:m.check_witnesses(X,[w])
 except AssertionError as e:cases.append({'name':name,'expectedWitness':key,'rejected':True,'error':str(e)});return
 raise AssertionError('NEGATIVE_ACCEPTED '+name)
def remove(X,w):X[w['entryId']]['items'][w['itemIndex']]['a']=X[w['entryId']]['items'][w['itemIndex']]['a'].replace(w['html'],'',1)
def link_only(X,w):X[w['entryId']]['items'][w['itemIndex']]['a']=X[w['entryId']]['items'][w['itemIndex']]['a'].replace(w['html'],'<p><a href="'+w['route']+'">查看关联知识</a></p>',1)
def wrong_topic(X,w):remove(X,w);X['own-runtime-usage']['items'][0]['a']+=w['html']
def bad_identity(X,w):X[w['entryId']]['items'][w['itemIndex']]['q']+='（错题）'
negative('adapter-tool-pairing-paragraph-deleted','ai-agent-6#8:b10',remove)
negative('related-link-does-not-cover-runtime-contract','own-agent-runtime-design#0:b3',link_only)
negative('exact-paragraph-in-wrong-topic-is-not-coverage','own-agent-runtime-design#2:b5',wrong_topic)
negative('correct-prose-under-changed-question-is-not-coverage','own-os-sandbox#1:b10',bad_identity)
assert before=={str(f):hashlib.sha256(f.read_bytes()).hexdigest()for f in files},'ACTUAL_DIST_WAS_MODIFIED'
print(json.dumps({'status':'PASS_ACTUAL_EXISTING_WITNESS_NEGATIVES','dist':str(a.dist),'baselineExistingWitnesses':len(existing),'cases':cases,'actualDistUnchanged':True,'candidateOverlay':False,'actualFinalAcceptance':False},ensure_ascii=False,indent=2))
