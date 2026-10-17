"""One-time, byte-preserving source extraction. Normal builds never read the backup."""
from pathlib import Path
import re,json,hashlib,argparse
project=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description='Reference-only extraction of the original page; normal builds use src/ and content/.')
parser.add_argument('--out',required=True,help='A new scratch directory; never the maintained project directory')
parser.add_argument('--baseline',default=str(project/'baseline'))
args=parser.parse_args()
root=Path(args.out).resolve();original=Path(args.baseline).resolve()
if root==project or root.exists():parser.error('--out must be a new, nonexistent scratch directory')
root.mkdir(parents=True);(root/'public/project').mkdir(parents=True)
s=(original/'index.html').read_text()
def put(name,text):
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
def js(name,start,end):put('src/'+name,''.join(lines[start-1:end]))
css=re.search(r'<style>([\s\S]*?)</style>',s).group(1)
put('src/styles/main.css',css)
boot=re.search(r'<script>([\s\S]*?)</script>',s).group(1)
# Keep the first-paint script inline and byte-for-byte, before the stylesheet.
shell=re.sub(r'<style>[\s\S]*?</style>','<link rel="stylesheet" href="./assets/styles/main.css">\n  <link rel="stylesheet" href="./assets/styles/loading.css">',s,count=1)
shell=re.sub(r'<script[^>]*id="data"[^>]*>[\s\S]*?</script>[\s\S]*?</script>', '<script type="module" src="./assets/runtime/bootstrap.js"></script>',shell,count=1)
put('src/index.html',shell)
lines=s.splitlines(keepends=True)
js('visuals/legacy-viz.js',1157,2803)
js('visuals/diagram-engine.js',2804,3505)
js('visuals/architecture-specs.js',3506,4807)
js('visuals/algorithm-traces.js',4808,8133)
# Classic scripts deliberately retain the legacy shared lexical environment.
js('app/catalog.js',8134,8173)
js('app/storage.js',8174,8213)
js('app/structure.js',8214,8229)
js('app/fragments.js',8230,8441)
js('app/renderers.js',8442,8689)
js('app/highlight-map.js',8690,8840)
js('app/dashboard.js',8841,8912)
js('app/navigation.js',8913,9006)
js('app/routing.js',9007,9087)
js('app/questions.js',9088,9121)
js('app/search.js',9122,9220)
js('app/events.js',9221,9442)
# Contents: full authoritative records, unchanged strings and question order.
data=json.loads(re.search(r'<script[^>]*id="data"[^>]*>([\s\S]*?)</script>',s).group(1))
meta={k:v for k,v in data.items() if k!='entries'}
meta['entryOrder']=[e['id'] for e in data['entries']]
chunks={}
for e in data['entries']:
 key=json.dumps([e['mod'],e['part'],e['cat']],ensure_ascii=False)
 name=e['mod']+'-'+hashlib.sha256(key.encode()).hexdigest()[:12]
 chunks.setdefault(name,[]).append(e)
for name,entries in chunks.items():put('content/chapters/'+name+'.json',json.dumps({'entries':entries},ensure_ascii=False,indent=2)+'\n')
put('content/metadata.json',json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
for name in ['.nojekyll','project/index.html','project/arch.svg']:(root/'public'/name).write_bytes((original/name).read_bytes())
put('reports/original-repository-readme.md',(original/'README.md').read_text())
print('Extracted',len(data['entries']),'entries in',len(chunks),'chapters')
