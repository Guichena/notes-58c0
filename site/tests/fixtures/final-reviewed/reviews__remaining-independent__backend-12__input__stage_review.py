import json,hashlib,re,copy,html,difflib
from pathlib import Path
R=Path(__file__).parent;root=R.parents[2]
h=lambda x:hashlib.sha256(x if isinstance(x,bytes) else x.encode()).hexdigest()
js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
def write(n,x):(R/n).write_text(json.dumps(x,ensure_ascii=False,indent=2))
b=json.loads((R/'live-base.json').read_text());new={k:copy.deepcopy(v['entry']) for k,v in b.items()};spans=[]
def rep(id,path,a,z,reason='Replace detached implementation promise with explicit design/verification contract; preserve all conditions.'):
 v=new[id]
 for k in path[:-1]:v=v[k]
 s=v[path[-1]];assert a in s,(id,path,a)
 spans.append(dict(entryId=id,path=path,before=a,after=z,beforeSha256=h(a),afterSha256=h(z),occurrences=s.count(a),reason=reason));v[path[-1]]=s.replace(a,z)
def q(id,i,a,z):rep(id,['items',i,'a'],a,z)
# Explicit revisions below.
# Strip exact repeated lead only; leave variant headings and all conditions.
for id,e in new.items():
 for i,item in enumerate(e.get('items',[])):
  plain=re.sub(r'^<p[^>]*><span[^>]*>本质</span>|</p>$','',item.get('lead',''));dup='<p class="md-p">'+plain+'</p>'
  if plain and dup in item['a']:rep(id,['items',i,'a'],dup,'','Remove exact duplicated authored-lead paragraph; all unique facts remain.')
def lead(id,i,body):
 old=new[id]['items'][i]['lead'];z='<p class="md-p sx-ess"><span class="sx-tag">本质</span>'+body+'</p>';rep(id,['items',i,'lead'],old,z,'Answer the question first and name alternatives, rather than only one input or branch.');q(id,i,old,z)
lead('own-os-diagnostics',2,'GDB 调试先匹配程序、符号与安全停点，再限定可读的半开字节范围导出并核对长度；dump 不是对象序列化，attach 和转储都要控制暂停与敏感数据风险。')
lead('own-os-design',2,'先按模型等待、CPU 计算、持久状态和取消恢复拆工作负载，再比较 Java 与 Go 的生态、团队经验及实测资源成本；Java 既有栈成熟可优先复用，Go 依赖适配和预算更合适时可选，语言本身不代替并发上限与故障协议。')
lead('own-os-ipc',3,'悲观策略先互斥再操作，乐观策略先计算再原子验证版本；选择取决于冲突与重做成本。跨进程共享字节还需明确布局、真正的进程共享同步与崩溃恢复，普通 Java 锁或 volatile 不能直接替代。')
q('own-network-web',2,'这里最后还有一个空行，才形成分派边界。','以本节末尾的任务进度字段表为例，id 为 103、event 为 progress，data 承载 jobId=j-7 与 percent=60；真正在线上传输时还必须以空行结束，才形成分派边界。')
q('own-os-files',1,'SparseFileWindow.java创建自己拥有的稀疏临时文件','可设计 SparseFileWindow 验证：创建自己拥有的稀疏临时文件')
q('own-os-files',1,'完整sendfile_probe.cpp在本机Linux的两个自有临时普通文件间传输','可设计 sendfile_probe.cpp，在本机 Linux 的两个自有临时普通文件间传输')
q('own-os-files',1,'教学fixture没有该路径。','上述普通文件 fixture 不覆盖该路径，需另外设计验证。')
q('own-os-files',1,'中的完整示例理解。','中的共享/私有映射与关闭边界一起理解。')
q('own-os-files',3,'实现以64KiB块扫描输入','可以按 64KiB 块扫描输入')
q('own-os-files',3,'line_index.py提供上下文管理、字节/UTF-8读取、异常、重复close、索引边界和并发关闭保护。','line_index.py 可作为实现名；接口应提供上下文管理、字节/UTF-8 读取、异常、重复 close、索引边界和并发关闭保护。使用 ExceptionGroup/BaseExceptionGroup 的这一设计以 Python 3.11 或更新版本为前提，不把它当成所有 Python 3 都支持的接口。')
q('own-os-files',3,'当前实现用同一锁串行化读取与关闭','上述设计用同一锁串行化读取与关闭')
q('own-os-files',3,'当前实现的索引是临时文件','上述设计的索引是临时文件')
q('own-os-files',3,'以下小文件测试用独立字节分隔参考核对每行','应设计小文件测试，用独立字节分隔参考核对每行')
# Empty supplementary headings are replaced by concise cross-references, retaining topic knowledge and anchors.
id='own-os-files';i=3
for title,body in [('相关追问','这里补充逐行索引的边界验证；完整问题变体与文件协议见本题前文。'),('磁盘索引 映射与按需工作集','索引按 64KiB 扫描生成小端 uint64 偏移，读取使用 pread；映射只建立地址空间关系，工作集随访问形成。'),('结构化格式与索引压缩的追问','JSONL 和 TSV 必须先确认物理行是否等于记录；每固定 K 行保存块入口可压缩偏移，但 K 的增长与解码成本会改变定位复杂度。'),('性能 并发与Python库交付怎样验收','分别报告构建与取行、冷暖页、RSS、行长和并发关闭；wheel 安装与 CI 小样本不能冒充数百 GB 负载验收。'),('逐行索引的接口与边界','接口须限制行字节数并保持源版本稳定；映射失效、短读和清理异常必须可见。')]:
 pattern='<h3 class="md-h md-h3">'+title+'</h3>'
 a=new[id]['items'][i]['a'];pos=a.index('id="add-own-algo-');j=a.find(pattern,pos)
 if j>=0:
  # replace precisely that occurrence using suffix span, not first body heading
  end=j+len(pattern);following=re.match(r'<h[23]\b',a[end:])
  if following:rep(id,['items',i,'a'],a[j:end]+a[end:end+3],pattern+'<p class="md-p">'+body+'</p>'+a[end:end+3],'Fill formerly empty supplemental topic with retained conditions; no source topic dropped.')
q('own-os-ipc',1,'Banker实现同步安全检查、申请与归还','Banker 可作为管理器模型名；实现应同步安全检查、申请与归还')
q('own-os-ipc',4,'给出Java21在Linux本地文件系统上的协作式映射计数器。','这里讨论 Java 21 在 Linux 本地文件系统上的协作式映射计数器设计。')
q('own-os-ipc',4,'程序用短命子JVM退出后再清理自己的文件。','验证时可让短命子 JVM 退出后再清理自己的文件。')
q('own-os-java-process',0,'ProcessDemo完整展示父子入口、标准流通信、退出码与超时兜底。','可将验证模型命名为 ProcessDemo，覆盖父子入口、标准流通信、退出码与超时兜底。')
q('own-os-java-process',0,'代码用三个I/O工作者并发写入和读取两条输出流','设计可用三个 I/O 工作者并发写入和读取两条输出流')
q('own-os-java-process',0,'Q13的ProcessDemo覆盖本地协议和失败路径','Q13 的 ProcessDemo 验证方案针对本地协议和失败路径')
q('own-os-java-process',1,'代码中的确定性压力测试使用k=3','确定性压力测试可使用 k=3')
p=['readingNotesHtml'];id='own-os-io'
for a,z in [('js_pools.mjs同时提供promisePool和真实Node Worker池。','可将两种验证模型组织为 js_pools.mjs，分别讨论 promisePool 与真实 Node Worker 池。'),('latest_chunks.mjs提供单拥有者','latest_chunks.mjs 可作为模型名，协议应保证单拥有者'),('Node适配器用实际worker_threads承载它，浏览器可用self.onmessage和self.postMessage接同一核心。','Node 适配器可用实际 worker_threads 承载，浏览器可用 self.onmessage 与 self.postMessage 接同一核心；两种宿主仍需分别验证。'),('另1000次已兑现await没有推进timer，未来timer await后timer执行。','可另做 1000 次已兑现 await 的对照：这组微任务可能持续占住检查点，timer 尚未推进；改为等待未来 timer 的 Promise，才让后续 task 有机会运行。这里给的是时序验证目标。'),('两个样例都观察nextTick、Promise、queueMicrotask、immediate、timer的顺序。','这两种入口对应的受控样例应分别核对 nextTick、Promise、queueMicrotask、immediate、timer 的顺序。'),('给出事件循环顺序推演与可运行示例','给出事件循环顺序推演与验证条件'),('完整ordered函数中callback(input[i],i)返回值经Promise链吸收','ordered 函数应让 callback(input[i],i) 返回值经 Promise 链吸收'),('题目要求的实现源码没有async/await关键字。','若自行实现，须按题目约束不使用 async/await 关键字。'),('完整任务池：','任务池协议：')]:rep(id,p,a,z)
# Exact non-code protocol declarations remain prose; no executable listing is introduced.
patches=[];dispositions=[];ret=[]
def leaves(v,p=[]):
 if isinstance(v,dict):
  for k,z in v.items():yield from leaves(z,p+[k])
 elif isinstance(v,list):
  for k,z in enumerate(v):yield from leaves(z,p+[k])
 else:yield p,v
for id,e in new.items():
 old=b[id]['entry'];nv={tuple(p):v for p,v in leaves(e)};ds=[]
 for path,v in leaves(old):
  z=nv[tuple(path)];changed=v!=z;ds.append(dict(path=path,status='rewrite' if changed else 'retain',beforeSha256=h(js(v)),afterSha256=h(js(z))))
  if changed:patches.append(dict(entryId=id,sourcePath=b[id]['source'],path=path,before=v,after=z,beforeSha256=h(v),afterSha256=h(z),entryBeforeSha256=h(js(old)),reasons=[s['reason'] for s in spans if s['entryId']==id and s['path']==path]))
  if isinstance(v,str):
   blocks=re.findall(r'<(?:p|li|h[1-6])\b[^>]*>.*?</(?:p|li|h[1-6])>',v,re.S) if '<' in v else [v]
   for i,block in enumerate(blocks):ret.append(dict(entryId=id,path=path,block=i,beforeSha256=h(block),sourceText=html.unescape(re.sub('<[^>]*>',' ',block)),disposition='exact-retained' if block in z else 'guarded rewrite; unique conditions retained in same leaf',targetPath=path))
 dispositions.append(dict(entryId=id,preflightMatches=b[id]['preflightMatches'],fields=ds));write(id+'-staged.json',e)
write('staged-leaf-replacements.json',patches);write('source-span-map.json',spans);write('per-entry-dispositions.json',dispositions);write('retention-map.json',ret)
print(len(patches),len(spans))
