#!/usr/bin/env python3
"""Build portable reading documents. Python 3 standard library + Pandoc."""
import hashlib
import html
import json
import posixpath
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = json.loads((ROOT / 'documents.json').read_text(encoding='utf-8'))
GROUPS = [('concurrency', 'Java · 并发'), ('jvm', 'Java · JVM')]

def esc(s):
    return html.escape(s, quote=True)

def relative(target, current):
    return posixpath.relpath(target, posixpath.dirname(current) or '.')

def shell(title, current, content):
    return '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' + esc(title) + ' · Java 学习笔记</title><link rel="stylesheet" href="' + relative('assets/reading.css', current) + '"></head><body><a class="skip" href="#main">跳至正文</a><header class="topbar"><a class="brand" href="' + relative('index.html', current) + '">Java 学习笔记</a><span>理解机制 · 分清边界 · 推敲取舍</span></header>' + content + '</body></html>\n'

def nav(current):
    parts = ['<nav class="rail" aria-label="知识主题">']
    for group, label in GROUPS:
        parts.append('<p>' + label + '</p>')
        for d in DOCS:
            if d['group'] == group:
                parts.append('<a href="' + relative(d['page'], current) + '"' + (' aria-current="page"' if d['page'] == current else '') + '>' + esc(d['label']) + '</a>')
    return ''.join(parts) + '</nav>'

def article(d):
    source = (ROOT / d['source']).read_text(encoding='utf-8')
    body = subprocess.check_output(['pandoc', '-f', 'gfm', '-t', 'html5', '--no-highlight', '--wrap=none'], input=source, text=True)
    # Link explicit document-title references without changing their visible wording.
    aliases = {}
    for other in DOCS:
        for title in [other['title'], other['title'].split('：')[0]]:
            aliases[re.sub(r'\s+', '', title)] = other['page']
    def reference(m):
        target = aliases.get(re.sub(r'\s+', '', html.unescape(m[1])))
        return '<a href="' + relative(target, d['page']) + '">' + m[0] + '</a>' if target and target != d['page'] else m[0]
    body = re.sub(r'《([^<>《》]+)》', reference, body)
    body = re.sub(r'<table>(.*?)</table>', r'<div class="table-wrap"><table>\1</table></div>', body, flags=re.S)
    headings = re.findall(r'<h([23]) id="([^"]+)">(.*?)</h[23]>', body, re.S)
    toc = '<ol>' + ''.join('<li' + (' class="sub"' if level == '3' else '') + '><a href="#' + esc(i) + '">' + re.sub('<[^>]+>', '', title) + '</a></li>' for level, i, title in headings) + '</ol>'
    content = '<div class="layout">' + nav(d['page']) + '<main id="main"><p class="eyebrow">Java / ' + ('并发' if d['group'] == 'concurrency' else 'JVM') + '</p><div class="meta">完整知识正文 · <a href="' + relative(d['source'], d['page']) + '">Markdown 原文</a></div><details class="mobile-toc"><summary>本篇目录</summary>' + toc + '</details><article>' + body + '</article><footer class="endnote"><a href="' + relative('index.html', d['page']) + '">返回知识目录</a> · 正文与目录可离线阅读；规范与参考资料链接需要联网。</footer></main><aside class="outline" aria-label="本篇目录"><p>本篇目录</p>' + toc + '</aside></div>'
    output = ROOT / d['page']
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(shell(d['title'], d['page'], content), encoding='utf-8')

def index():
    content = '<main id="main" class="index"><p class="eyebrow">JAVA / KNOWLEDGE NOTES</p><h1>从共享状态，到虚拟机运行。</h1><p class="intro">沿着问题理解 Java：状态怎样安全共享，任务怎样结束，对象怎样存活，运行时又怎样执行与回收。</p><p class="reading-path">按知识依赖安排阅读，不按热度排序。可以顺着两条路径建立整体认识，也可以直接进入当前遇到的问题。</p>'
    paths = {'concurrency':'先分清可见性与原子性，再理解互斥和等待，最后把边界放回任务与请求生命周期。', 'jvm':'先建立内存地图，再看对象、类与执行机制，最后连接垃圾回收和诊断证据。'}
    for group, label in GROUPS:
        content += '<section><h2 id="' + group + '">' + label + '</h2><p class="reading-path">' + paths[group] + '</p><ul class="reading-list">'
        for d in DOCS:
            if d['group'] == group:
                content += '<li><a href="' + d['page'] + '">' + esc(d['title']) + '</a><p>' + esc(d['question']) + '</p></li>'
        content += '</ul></section>'
    content += '<footer class="endnote">本知识集仅包含这里列出的主题，不代表 Java 知识的完整覆盖。<br>页面无需服务即可打开；保留目录结构即可离线阅读。<a href="README.md">使用与重建说明</a> · <a href="SHA256SUMS.txt">文件校验清单</a></footer></main>'
    (ROOT / 'index.html').write_text(shell('知识目录', 'index.html', content), encoding='utf-8')

def checksums():
    files = sorted(p for p in ROOT.rglob('*') if p.is_file() and p.name != 'SHA256SUMS.txt' and '__pycache__' not in p.parts)
    (ROOT / 'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.relative_to(ROOT).as_posix() + '\n' for p in files), encoding='utf-8')

if __name__ == '__main__':
    for doc in DOCS:
        article(doc)
    index()
    checksums()
    print(f'Built {len(DOCS)} knowledge documents and index.html.')
