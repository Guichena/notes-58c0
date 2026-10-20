"""Static-only checks. These do not substitute for a browser render."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
ROOT=Path(__file__).resolve().parent
class Audit(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.links=[];self.assets=[];self.h1=0;self.h2=0;self.code=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a':self.links.append(a.get('href',''))
        if tag in ['img','script'] and a.get('src'):self.assets.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet':self.assets.append(a.get('href'))
        if tag=='h1':self.h1+=1
        if tag=='h2':self.h2+=1
        if tag=='pre':self.code+=1
results=[]
for f in sorted(ROOT.glob('*.html')):
    if f.name=='rag-diagram.html':continue
    a=Audit();a.feed(f.read_text())
    bad=[]
    for href in a.links:
        u=urlsplit(href)
        if u.scheme or u.netloc:continue
        if u.path and not (ROOT/unquote(u.path)).exists():bad.append(href)
        elif not u.path and u.fragment and unquote(u.fragment) not in a.ids:bad.append(href)
    results.append(dict(file=f.name,h1=a.h1,h2=a.h2,codeBlocks=a.code,duplicateIds=len(a.ids)-len(set(a.ids)),brokenLocalLinks=bad,externalAssets=a.assets))
report={'type':'static HTML checks only; browser visual QA not performed','files':results}
(ROOT/'structure-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
