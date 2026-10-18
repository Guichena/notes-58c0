#!/usr/bin/env python3
"""Final acceptance reads only an explicit built dist. No overlay, candidate entries or fallback."""
import argparse,hashlib,json,pathlib,re,sys
from html.parser import HTMLParser
O=pathlib.Path(__file__).resolve().parent
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
J=lambda n:json.loads((O/n).read_text())
B=lambda s:[m.group(0)for m in re.finditer(r'<(p|h[1-6]|li|summary|pre|tr)\b[^>]*>[\s\S]*?</\1>',s)]
def need(ok,msg):
 if not ok:raise AssertionError(msg)
class Balanced(HTMLParser):
 def __init__(self):super().__init__();self.stack=[]
 def handle_starttag(self,t,a):
  if t not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(t)
 def handle_endtag(self,t):
  need(bool(self.stack)and self.stack[-1]==t,'UNBALANCED_HTML '+t+' stack='+str(self.stack[-4:]));self.stack.pop()
def fixture_review():
 R=J('records.json')['records'];S=J('source-blocks.json');P=J('paragraph-destinations.json')['maps'];V=J('variant-condition-map.json')['variants'];W=J('evidence-witnesses.json')['witnesses'];D=J('display-questions.json');I=J('identity-baseline.json')['items'];N=J('new-paragraphs.json')
 allowed={('ai-agent-6',8),('own-os-sandbox',1),('own-agent-task-scenarios',0),('ai-agent-4',1)}
 need(len(R)==4 and{(r['entryId'],r['itemIndex'])for r in R}==allowed,'SCOPE')
 for r in R:
  need(r['path']==['items',r['itemIndex'],'a'],'NON_ANSWER_CHANGE')
  for side in ['before','after']:need(sha(r[side])==r[side+'Sha256'],'RECORD_HASH '+side)
  need(sha(r['questionGuard'])==r['questionSha256'],'QUESTION_GUARD_HASH')
  if r['mode'].startswith('append-only'):need(r['after'].startswith(r['before']),'CANONICAL_PREFIX_CHANGED')
  for anchor in re.findall(r'\bid="([^"]+)"',r['before']):need('id="'+anchor+'"'in r['after'],'SOURCE_ANCHOR_LOST '+anchor)
  parser=Balanced();parser.feed(r['after']);need(not parser.stack,'UNCLOSED_HTML')
 source=next(r for r in R if r['entryId']=='ai-agent-6');bs=B(source['before'])
 need(source['beforeSha256']=='6effa07afa592e573f16b970fbc09c96ee8e809b31ee7b2d452acb9d13ee42eb','NOT_369_SOURCE')
 need(len(bs)==len(S)==len(P)==87,'SOURCE_BLOCK_COUNT')
 for i,(s,p,b)in enumerate(zip(S,P,bs)):
  need(s['index']==p['sourceBlockIndex']==i and s['html']==p['sourceHtml']==b,'SOURCE_BLOCK_IDENTITY '+str(i))
  need(sha(b)==s['sha256']==p['sourceSha256'],'SOURCE_BLOCK_HASH')
 sections=J('source-sections.json');need(''.join(s['html']for s in sections)==source['before'],'SOURCE_SECTIONS_NOT_COMPLETE')
 for s in sections:need(sha(s['html'])==s['sha256']and source['before'][s['start']:s['end']]==s['html'],'SECTION_HASH')
 original=J('source-variants.json')['variants'];need(len(V)==len(original)==49,'QUESTION_COUNT')
 need([v['sourceVariantIndex']for v in V]==list(range(49)),'MISSING_QUESTION')
 wm={w['key']:w for w in W};need(len(wm)==len(W),'DUPLICATE_WITNESS_KEY')
 for w in W:
  need(sha(w['html'])==w['sha256'],'WITNESS_HASH '+w['key'])
  need(bool(re.match(r'<(?:p|tr)\b',w['html'])),'LINK_OR_HEADING_IS_NOT_SUBSTANCE '+w['key'])
  prose=re.sub(r'<a\b[^>]*>[\s\S]*?</a>','',w['html']);prose=re.sub('<[^>]+>','',prose).strip()
  need(len(prose)>=35,'INSUFFICIENT_NON_LINK_SUBSTANCE '+w['key'])
 used=set()
 for v,o in zip(V,original):
  need(v['sourceHtml']==o['html']==bs[v['sourceBlockIndex']],'ORIGINAL_QUESTION_CHANGED')
  need(sha(v['sourceHtml'])==v['sourceSha256']==o['sha256'],'ORIGINAL_QUESTION_HASH')
  need(v['sourceQuestion']==o['question']and v['sourceQuestionHtml']==o['questionHtml'],'QUESTION_WORDING')
  need(bool(v['conditions']),'QUESTION_HAS_NO_CONDITIONS')
  for c in v['conditions']:
   need(bool(c['condition'])and bool(c['witnessKeys']),'EMPTY_CONDITION')
   for key in c['witnessKeys']:need(key in wm,'MISSING_WITNESS_REF');used.add(key)
 for p in P:
  for c in p['conditions']:
   for key in c['witnessKeys']:need(key in wm,'MISSING_PARAGRAPH_WITNESS');used.add(key)
 need(used==set(wm),'UNREVIEWED_WITNESS')
 need(len(D)==8,'ADAPTER_QUESTION_COUNT')
 for d in D:need(d['html']in source['after'],'NORMALIZED_QUESTION_MISSING')
 need(not re.search(r'<a\b[^>]*href="https?://',source['after']),'PUBLIC_REFERENCE_FOOTER')
 need('版本资料（核对日期'not in source['after'],'EDITORIAL_FOOTER')
 need(S[23]['html']not in source['after']and S[25]['html']not in source['after'],'OFF_TOPIC_PARAGRAPH_REMAINS')
 for i in[1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18,19,21,28]:need(bs[i]in source['after'],'ADAPTER_CORE_LOST '+str(i))
 return R,P,V,W,D,I,N

def load_dist(dist):
 need(dist.is_absolute(),'ABSOLUTE_ACTUAL_DIST_REQUIRED');need((dist/'data/catalog.json').is_file(),'BUILT_DIST_CATALOG_REQUIRED')
 files=sorted((dist/'data/chapters').glob('*.json'));need(bool(files),'BUILT_DIST_CHAPTERS_REQUIRED');E={}
 for f in files:
  for e in json.loads(f.read_text())['entries']:need(e['id']not in E,'DUPLICATE_ENTRY');E[e['id']]=e
 return E,json.loads((dist/'data/catalog.json').read_text())
def item(E,k,n):need(k in E and 0<=n<len(E[k].get('items',[])),'MISSING_CANONICAL '+k+'/'+str(n));return E[k]['items'][n]
def check_witnesses(E,W,only_existing=False):
 count=0
 for w in W:
  if only_existing and w['origin']!='existing369':continue
  it=item(E,w['entryId'],w['itemIndex']);need(it.get('id')==w['questionId']and it['q']==w['question'],'CANONICAL_IDENTITY '+w['key'])
  need(w['html']in it['a'],'MISSING_SUBSTANTIVE_WITNESS '+w['key']);count+=1
 return count
def run_final(dist):
 R,P,V,W,D,I,N=fixture_review();E,cat=load_dist(dist)
 for r in R:
  it=item(E,r['entryId'],r['itemIndex']);need(it['q']==r['questionGuard']and it.get('id')==r['questionId'],'QUESTION_OR_INDEX_CHANGED')
  need(it['a']==r['after'],'UNAPPLIED_OR_CHANGED '+r['entryId']+'/'+str(r['itemIndex'])+'/a')
 for x in I:
  it=item(E,x['entryId'],x['itemIndex']);need(('id'in it)==x['idPresent'],'ID_PRESENCE_CHANGED')
  need({k:v for k,v in it.items()if k!='a'}==x['unchangedFields'],'NON_ANSWER_FIELDS_CHANGED')
 for entry in J('identity-baseline.json')['entries']:
  actual=E[entry['entryId']];need({k:v for k,v in actual.items()if k!='items'}==entry['unchangedEntryFields'],'ENTRY_METADATA_CHANGED '+entry['entryId']);need(len(actual['items'])==len(entry['items']),'QUESTION_COUNT_CHANGED')
  for q in entry['items']:
   it=actual['items'][q['index']];need(('id'in it)==q['idPresent']and {k:v for k,v in it.items()if k!='a'}==q['unchangedFields'],'QUESTION_ID_INDEX_OR_METADATA_CHANGED '+entry['entryId']+'/'+str(q['index']))
 checks=check_witnesses(E,W)
 for r in R:
  need(any(e['id']==r['entryId']for e in cat['entries']),'MISSING_CATALOG_ROUTE')
  for entry,target in re.findall(r'href="#/e/([^"/]+)(?:/([^"]+))?"',r['after']):
   need(entry in E or entry in cat.get('archivedRoutes',{}),'BROKEN_ENTRY_ROUTE '+entry)
   if target and entry in E:need((target.isdigit()and int(target)<len(E[entry].get('items',[])))or any(it.get('id')==target for it in E[entry].get('items',[])),'BROKEN_QUESTION_ROUTE '+entry+'/'+target)
 for d in D:need(d['html']in item(E,d['entryId'],d['itemIndex'])['a'],'WRONG_QUESTION_LOCATION')
 return{'status':'PASS_ACTUAL_FINAL_DIST','dist':str(dist),'changedLeaves':len(R),'sourceBlocks':len(P),'sourceQuestions':len(V),'fineConditions':sum(len(v['conditions'])for v in V),'substantiveWitnesses':checks,'buildRunByVerifier':False,'browserAcceptance':False}
def main():
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True);g.add_argument('--dist',type=pathlib.Path);g.add_argument('--check-fixtures',action='store_true');a=p.parse_args()
 if a.check_fixtures:
  R,P,V,W,D,I,N=fixture_review();print(json.dumps({'status':'PASS_CANDIDATE_STATIC_ONLY','leaves':len(R),'sourceBlocks':len(P),'questions':len(V),'conditions':sum(len(v['conditions'])for v in V),'witnesses':len(W),'notActualDistAcceptance':True}));return
 print(json.dumps(run_final(a.dist),ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except Exception as e:print(type(e).__name__+': '+str(e),file=sys.stderr);sys.exit(1)
