#!/usr/bin/env python3
"""Offline reading layout. Requires Python 3 and Pandoc; output requires no server/assets.
Usage: python render.py INPUT.md OUTPUT.html --topic hashmap
       python render.py --build-all ../
"""
from pathlib import Path
import argparse, html, re, subprocess, shutil
ROOT=Path(__file__).resolve().parent
TOPICS={'hashmap':('01','HashMap','从寻址到扩容，理解实现边界'), 'lru':('02','LRU 缓存','把淘汰策略写成可验证的不变量'), 'rag':('03','RAG 检索增强生成','从召回到回答，建立可诊断的链路')}
CSS='''
:root{--ink:#242a31;--muted:#626a74;--line:#dfe4eb;--blue:#215dcc;--paper:#fff;--wash:#f6f8fb}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:88px}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Noto Sans CJK SC","Microsoft YaHei",sans-serif;font-size:17px;line-height:1.8;overflow-wrap:anywhere}a{color:var(--blue);text-underline-offset:4px}a:hover{text-decoration-thickness:2px}a:focus-visible,summary:focus-visible{outline:3px solid var(--blue);outline-offset:4px}.skip{position:absolute;top:-100px;left:20px;background:white;padding:8px;z-index:10}.skip:focus{top:10px}.topbar{border-bottom:1px solid var(--line);background:white;padding:17px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:var(--ink);font-weight:700;text-decoration:none;letter-spacing:.06em;font-size:15px}.edition{font-size:12px;color:var(--muted);letter-spacing:.08em}.layout{display:grid;grid-template-columns:180px minmax(0,780px) 200px;gap:44px;max-width:1344px;margin:auto;padding:46px 28px 96px;align-items:start}.rail,.outline{position:sticky;top:28px;font-size:13px;line-height:1.6;max-height:calc(100vh - 56px);overflow:auto}.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--muted);margin:0 0 20px;font-weight:650}.rail a{display:block;text-decoration:none;color:var(--muted);padding:11px 0;border-bottom:1px solid var(--line)}.rail a[aria-disabled]{opacity:.55}.sample-row[aria-disabled]{opacity:.55}.rail a.active{color:var(--blue);font-weight:700}.rail .num{font-size:11px;display:inline-block;width:26px;letter-spacing:.04em}.rail-note{margin-top:26px;font-size:12px;color:var(--muted)}.outline{border-left:1px solid var(--line);padding-left:18px}.outline ol{padding:0;list-style:none;margin:0}.outline a{display:block;color:var(--muted);text-decoration:none;padding:5px 0;font-size:12px}.outline a:hover,.outline a.current{color:var(--blue)}main{min-width:0}.article-top{margin:0 0 16px;color:var(--blue);font-size:12px;letter-spacing:.09em;font-weight:650}.article-meta{color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:14px;margin-bottom:30px}h1,h2,h3,h4{line-height:1.4;letter-spacing:-.025em;scroll-margin-top:24px}h1{font-size:36px;margin:0 0 24px;font-weight:750}h2{font-size:25px;margin:52px 0 20px;padding-top:20px;border-top:1px solid var(--line)}h3{font-size:20px;margin:30px 0 14px}h4{font-size:18px;margin:26px 0 12px}p{margin:0 0 20px}li{margin:7px 0}ul,ol{padding-left:1.5em}strong{font-weight:700}blockquote{margin:24px 0;border-left:3px solid var(--blue);padding:2px 0 2px 20px;color:#46505c}blockquote p:last-child{margin-bottom:0}code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:.86em;background:#f1f4f8;border-radius:3px;padding:2px 4px;overflow-wrap:anywhere}pre{max-width:100%;margin:25px 0;padding:22px 24px;background:var(--wash);border:1px solid var(--line);border-radius:5px;overflow-x:auto;line-height:1.65;tab-size:4}pre code{padding:0;background:none;border-radius:0;font-size:13px;white-space:pre;overflow-wrap:normal}div.sourceCode{margin:24px 0;overflow:hidden}div.sourceCode pre{margin:0}.table-wrap{overflow:auto;margin:24px 0}table{border-collapse:collapse;font-size:14px;width:100%;min-width:480px}th,td{padding:12px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}th{background:var(--wash);font-weight:650}img,svg{max-width:100%;height:auto}hr{border:0;border-top:1px solid var(--line);margin:38px 0}details{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 0;margin:28px 0}summary{cursor:pointer;font-weight:650;color:var(--blue)}details[open] summary{margin-bottom:22px}.mobile-toc{display:none}.endnote{margin-top:56px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:12px}.sample-list{margin-top:40px}.sample-row{display:grid;grid-template-columns:42px 1fr 24px;padding:26px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--ink);align-items:center}.sample-row .num{color:var(--blue);font-size:13px}.sample-row strong{font-size:23px}.sample-row p{font-size:14px;color:var(--muted);margin:6px 0 0}.intro{font-size:19px;color:var(--muted);max-width:640px}.index-layout{max-width:1040px;display:block;padding:70px 40px 100px;margin:auto}.index-layout h1{font-size:42px}.index-layout .eyebrow{color:var(--blue)}
@media(max-width:1150px){.layout{grid-template-columns:150px minmax(0,780px);gap:32px}.outline{display:none}.mobile-toc{display:block}.layout{max-width:1018px}.rail{font-size:12px}}
@media(max-width:700px){.topbar{padding:15px 20px}.edition{font-size:10px;letter-spacing:0}.layout{display:block;padding:22px 22px 64px}.rail{position:static;max-height:none;display:flex;gap:20px;overflow-x:auto;margin-bottom:32px;border-bottom:1px solid var(--line)}.rail .eyebrow,.rail-note{display:none}.rail a{white-space:nowrap;border:0;padding:0 0 12px}.rail a.active{border-bottom:2px solid var(--blue)}.rail .num{width:21px}h1{font-size:29px}h2{font-size:23px;margin-top:40px}h3{font-size:20px}pre{padding:17px 18px;margin:22px 0}body{font-size:17px;line-height:1.8}.index-layout{padding:44px 22px 70px}.index-layout h1{font-size:34px}.intro{font-size:17px}.sample-row strong{font-size:21px}.article-meta{line-height:1.8}.mobile-toc{font-size:14px}.mobile-toc ol{list-style:none;padding-left:0}.mobile-toc a{display:block;padding:5px 0}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{.topbar,.rail,.outline,.mobile-toc{display:none}.layout{display:block;padding:0}body{font-size:11pt}h2{break-after:avoid}pre{white-space:pre-wrap;overflow:visible}pre code{white-space:pre-wrap}a{color:inherit}.endnote{font-size:9pt}}
'''
CSS += '.architecture{margin:28px 0;padding:24px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.architecture figcaption{font-size:14px;color:var(--muted);margin-bottom:22px}.architecture-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}.architecture h4{font-size:14px;color:var(--blue);margin:0 0 16px}.flow{padding:0;list-style:none;font-size:14px}.flow li{padding:10px 12px;background:var(--wash);margin:0 0 22px;position:relative}.flow li:not(:last-child):after{content:"↓";position:absolute;bottom:-23px;left:12px;color:var(--blue)}.flow small{display:block;color:var(--blue);font-size:12px}.diagram-exits{font-size:13px;border-top:1px solid var(--line);padding-top:18px}.diagram-observability{font-size:12px;color:var(--muted);margin:12px 0 0}@media(max-width:700px){.architecture-grid{grid-template-columns:1fr;gap:12px}}'
SCRIPT='''<script>const links=[...document.querySelectorAll('.outline a')];const observer=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){for(const a of links)a.classList.toggle('current',a.hash==='#'+e.target.id)}},{rootMargin:'0px 0px -65% 0px'});document.querySelectorAll('h2[id]').forEach(h=>observer.observe(h));</script>'''
def shell(title, content):
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>'+html.escape(title)+' · 学习笔记</title><style>'+CSS+'</style></head><body><a class="skip" href="#main">跳至正文</a><header class="topbar"><a class="brand" href="index.html">学习笔记 / READING ROOM</a><span class="edition">内容与阅读版式 · 离线样稿</span></header>'+content+SCRIPT+'</body></html>'
def topic_link(k, current=None):
    return f'href="{k}.html"' if (ROOT/f'{k}.html').exists() or k==current else 'aria-disabled="true" title="本批其他样稿尚在生成"'
def nav(topic):
    return '<nav class="rail" aria-label="样稿导航"><p class="eyebrow">三篇样稿 / SAMPLES</p>'+''.join(f'<a class="{"active" if k==topic else ""}" {"aria-current=page" if k==topic else ""} {topic_link(k,topic)}><span class="num">{n}</span>{label}</a>' for k,(n,label,desc) in TOPICS.items())+'<p class="rail-note">离线阅读版<br>仅样稿，不替换正式内容。</p></nav>'
def render(source, output, topic):
    md=Path(source).read_text()
    # Resolve prose [S1] markers to the actual bibliography URL without changing source Markdown.
    citations=dict(re.findall(r'\[(S\d+) [^\]]*\]\((https?://[^)]+)\)',md))
    for label,url in citations.items():
        md=re.sub(r'\['+re.escape(label)+r'\](?!\()',f'[{label}]({url})',md)
    body=subprocess.check_output(['pandoc','-f','gfm+raw_html','-t','html5','--no-highlight','--wrap=none'],input=md,text=True)
    if topic=='rag' and (ROOT/'rag-diagram.html').exists():
        diagram=(ROOT/'rag-diagram.html').read_text()
        body=re.sub(r'(<h3[^>]*>2\.2)',lambda m:diagram+m[1],body,count=1)
    # Keep code artifacts beside standalone HTML so in-text filenames remain true.
    supporting=[]
    for f in sorted(Path(source).parent.iterdir()):
        if f.is_file() and f.suffix in ['.java','.py','.sh','.txt','.json','.md'] and f.resolve()!=Path(source).resolve():
            dest=Path(output).parent/f.name
            if f.resolve()!=dest.resolve(): shutil.copy2(f,dest)
            supporting.append(f)
            body=body.replace('<code>'+html.escape(f.name)+'</code>', '<a href="'+html.escape(f.name)+'"><code>'+html.escape(f.name)+'</code></a>')
    if topic=='hashmap':
        program=Path(source).parent/'HashMapProbe.java'
        if program.exists(): body+='<h2 id="complete-program">完整可运行验证代码</h2><p>以下程序与随附源文件一致，可直接保存为 HashMapProbe.java 运行。</p><pre><code>'+html.escape(program.read_text())+'</code></pre>'
    if topic=='rag':
        program=Path(source).parent/'verify_metrics.py'
        if program.exists(): body+='<h2 id="metrics-program">算例复核代码</h2><p>仅核验教学算例的算术与指标约定，不代表真实系统性能。</p><pre><code>'+html.escape(program.read_text())+'</code></pre>'
    if supporting:
        body+='<h2 id="supporting-files">随附源码与验证记录</h2><ul>'+''.join('<li><a href="'+html.escape(f.name)+'">'+html.escape(f.name)+'</a></li>' for f in supporting)+'</ul><p>正文可独立离线阅读；下载源码或验证记录时，请保留本 HTML 与随附文件的相对位置。</p>'
    body=re.sub(r'<table>(.*?)</table>',r'<div class="table-wrap"><table>\1</table></div>',body,flags=re.S)
    heads=re.findall(r'<h2 id="([^"]+)">(.*?)</h2>',body,re.S)
    toc='<ol>'+''.join('<li><a href="#'+html.escape(i)+'">'+re.sub('<[^>]+>','',t)+'</a></li>' for i,t in heads)+'</ol>'
    titlematch=re.search(r'<h1[^>]*>(.*?)</h1>',body,re.S)
    title=re.sub('<[^>]+>','',titlematch[1]) if titlematch else TOPICS[topic][1]
    titleblock=titlematch[0] if titlematch else '<h1>'+html.escape(title)+'</h1>'
    if titlematch: body=body.replace(titlematch[0],'',1)
    chars=len(re.sub(r'\s','',md)); minutes=max(1,round(chars/450))
    content='<div class="layout">'+nav(topic)+'<main id="main"><p class="article-top">样稿 '+TOPICS[topic][0]+' / '+TOPICS[topic][1]+'</p>'+titleblock+f'<div class="article-meta">约 {minutes} 分钟阅读 · 正文与核心代码完整展开 · 可离线阅读</div><details class="mobile-toc"><summary>本篇目录</summary>'+toc+'</details><article>'+body+'</article><footer class="endnote">样稿阅读至此。此文件为独立离线副本，不修改原有笔记或线上版本。<br><a href="index.html">返回样稿目录</a></footer></main><aside class="outline" aria-label="本篇目录"><p class="eyebrow">本篇目录 / ON THIS PAGE</p>'+toc+'</aside></div>'
    Path(output).write_text(shell(title,content))
    return len(heads)
def index():
    content='<main id="main" class="index-layout"><p class="eyebrow">LEARNING NOTES · EDITORIAL SAMPLES</p><h1>把知识讲清楚，<br>也让阅读更轻松。</h1><p class="intro">从数据结构到检索增强生成，三篇完整样稿。<br>先理解机制，再看实现，最后检查边界与取舍。</p><div class="sample-list">'+''.join(f'<a class="sample-row" {topic_link(k)}><span class="num">{n}</span><div><strong>{label}</strong><p>{desc}</p></div><span aria-hidden="true">↗</span></a>' for k,(n,label,desc) in TOPICS.items())+'</div><footer class="endnote">离线样稿 · 仅用于审阅内容与阅读体验<br>本批不替换既有笔记，不发布网站，不覆盖线上版本。</footer></main>'
    (ROOT/'index.html').write_text(shell('三篇学习样稿',content))
def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?');p.add_argument('output',nargs='?');p.add_argument('--topic',choices=TOPICS,default='hashmap');p.add_argument('--build-all',metavar='SAMPLES_DIR');a=p.parse_args()
    if a.build_all:
        for topic in TOPICS:
            files=sorted((Path(a.build_all)/topic).glob('*.md'))
            files=[f for f in files if not any(s in f.stem.lower() for s in ['source','readme','qa','manifest','来源','核验'])]
            if len(files)!=1: raise SystemExit(f'{topic}: expected one content Markdown, got {files}; use explicit single-file render')
            print(topic,render(files[0],ROOT/f'{topic}.html',topic))
    elif a.source and a.output: print(render(a.source,a.output,a.topic),'sections rendered')
    else: p.error('provide INPUT OUTPUT or --build-all')
    index()
if __name__=='__main__':main()
