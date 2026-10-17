import json,hashlib,copy,re
from pathlib import Path
p=Path(__file__).parent;h=lambda b:hashlib.sha256(b).hexdigest();load=lambda f:json.loads((p/f).read_text())
b=load('input/live-base.json');entries=load('composed-entries.json');a={k:copy.deepcopy(v['entry'])for k,v in b.items()};spans=load('input/source-span-map.json')
for s in spans:
 v=a[s['entryId']]
 for k in s['path'][:-1]:v=v[k]
 k=s['path'][-1];assert v[k].count(s['before'])==s['occurrences'];v[k]=v[k].replace(s['before'],s['after'])
for x in load('input/staged-leaf-replacements.json'):
 v=a[x['entryId']]
 for k in x['path']:v=v[k]
 assert v==x['after']
for k,e in entries.items():
 rendered=(p/'rendered'/f'{k}-rendered.html').read_text()
 if e.get('readingNotesHtml'):assert e['readingNotesHtml'] in rendered
checks=load('mechanical-checks.json')
for c in checks:
 if c['numericRemoved']:
  assert c['entryId']=='own-os-process' and c['path']==['readingNotesHtml'] and c['numericRemoved']==['12.14']
  c['numericDisposition']='Regex word-boundary artifact: CPython3.12.14 becomes CPython 3.12.14; exact patch remains. All finite examples and bounds retained.'
(p/'mechanical-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
(p/'span-replay-check.json').write_text(json.dumps({'originalSpans':len(spans),'sequentialReplayEqualsFrozenLeaves':True,'readingNotesInFullRenders':True},indent=2))
m=dict(batch='backend-13',status='approved-with-explicit-source-gaps',entries=4,questions=17,originalLeaves=23,originalSpans=92,approvedLeaves=25,additionalCompositionEdits=11,approvedArtifact='approved-leaves.json',approvedArtifactSha256=h((p/'approved-leaves.json').read_bytes()),coverage='All 105581 characters of candidate text, all 17 questions, unchanged siblings, outlines, leads and full native/OS/Python/Lua supplements read; all 92 author exact spans replayed.',checks='Frozen input hashes; live original guards; source archive hash; original identifiers and question order; links/anchors/images/code; numeric retention with documented spacing false-positive; 17 compiled cards plus four complete entry renders.',limits=['No native, Python, Lua, UE, JVM runtime experiment; no browser layout or full-site regression.','Lua manual retrieval failed; exact 5.4.9 lgc.c independently retrieved closes GC-source subset only, not full manual/OOP coverage.','Current unversioned Protobuf, ABI and PE references do not certify deployment versions.'],files={str(f.relative_to(p)):h(f.read_bytes())for f in sorted(p.rglob('*'))if f.is_file() and f.name!='composition-manifest.json'})
(p/'composition-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(m['approvedArtifactSha256'])
