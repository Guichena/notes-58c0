import json,hashlib,re,copy,difflib
from pathlib import Path
P=Path(__file__).parent
h=lambda s:hashlib.sha256(s.encode() if isinstance(s,str) else s).hexdigest()
js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
load=lambda n:json.loads((P/n).read_text())
b=load('input/live-base.json');out=load('input/staged-leaf-replacements.json');changes=[]
for f in load('input/frozen-manifest.json')['files']:assert h((P/'input'/Path(f['path']).name).read_bytes())==f['sha256'],f['path']
def get(v,p):
 for k in p:v=v[k]
 return v
def put(v,p,a):
 for k in p[:-1]:v=v[k]
 v[p[-1]]=a
def fix(id,path,old,new,reason):
 x=next((x for x in out if x['entryId']==id and x['path']==path),None)
 if x is None:
  before=get(b[id]['entry'],path);x=dict(entryId=id,sourcePath=b[id]['source'],path=path,before=before,after=before,beforeSha256=h(before),afterSha256=h(before),entryBeforeSha256=h(js(b[id]['entry'])),reasons=[]);out.append(x)
 assert x['after'].count(old)==1,(id,old);x['after']=x['after'].replace(old,new);x['afterSha256']=h(x['after']);x['reasons'].append('Independent: '+reason);changes.append(dict(entryId=id,path=path,before=old,after=new,reason=reason))
fix('own-mysql-ch27',['items',0,'a'],'验证时可复制 log 的前 validBytes 字节，构造新的内存前缀来复查扫描结果。','验证时可用 Arrays.copyOf(log, validBytes) 复制 log 的前 validBytes 字节，构造新的内存前缀来复查扫描结果。','Retain original concrete API example without claiming supplied executable test.')
for tag,title in [('h2','MySQL 与数据库系统设计面试手册'),('h3','练习环境与代码使用'),('h3','这册可以怎样复习'),('h3','阅读目录')]:
 fix('own-mysql-guide',['html'],f'<{tag} class="md-h md-{tag}">{title}</{tag}>','','Remove adjacent duplicate unanchored title, preserving anchored title and full body.')
fix('own-network-source-guide',['html'],'配套资料包含 36 份程序、驱动和脚本：传输篇 14 份，应用篇 22 份。','原资料索引列出 36 份程序、驱动和脚本：传输篇 14 份，应用篇 22 份；本页保留名称与阅读定位，不据此证明已取得完整可执行源码。','Qualify indexed source availability; retain exact counts and every original link.')
fix('own-network-source-guide',['html'],'附录 应用层完整教学程序','附录 应用层教学程序索引与契约','Index is not a complete executable program.')
p=['readingNotesHtml'];id='own-network-transport'
fix(id,p,'LT 与 ET 的完整本地管道练习','LT 与 ET 的本地管道练习契约','No missing runnable implementation promise.')
add={
'Internet checksum 的计算与验证边界':'按网络序把相邻字节组成 16 位数，进位回卷后取反；跨输入块保留未配对末字节，不能每块独立补零。IPv4 UDP 伪首部参加计算但不额外发送，校验字段先置零，接收时含校验字段求和。此处验证算术与切片一致性，不提供来源认证或业务提交证明。',
'自适应限额的输入与反馈合同':'准入上限控制在途资源，完成必须对应真实释放；降低上限只阻止后续准入，不会取消已占用资源。扩容要以健康且实际用满为前提，过载才触发缩减，参数错误或鉴权失败不能混作拥塞反馈。',
'JSON 字节大小与编码边界':'先完成 JSON 转义和序列化，再以确定的 UTF-8 编码计数字节；Java String.length() 计算 UTF-16 码元。裸 JSON、压缩后内容、TLS 记录及链路字节分别计量，不能由字符串长度推出对象内存或线上总成本。',
'Java 字节序与读写一致性':'协议先约定大端，写端按高位到低位输出，读端用同一规则重建。对 byte 做移位或拼接前先以 0xff 屏蔽符号扩展；长度值还要校验负数、上限和加法溢出，字节序正确并不代表输入可信。',
'C++ 字节序与表示差异':'编码应显式抽取固定宽度无符号值的各个字节，解码先转为无符号再移位组合。不能把结构体内存直接作为稳定协议：填充、端序、对齐与类型宽度都有条件；网络序和机器内存布局是不同问题。',
'NIO 组件职责与生命周期':'Channel 执行传输，Buffer 保存字节与 position/limit/capacity，Selector 报告已注册通道的就绪条件。就绪后仍需处理部分读写、0、EOF 和异常；仅在有待写数据时关注写就绪，避免空转。所有退出分支都要取消注册并关闭自己拥有的资源。',
'Buffer 存储、视图与位置状态':'写入后 flip 把当前 position 设为 limit 并回到起点，读出后 compact 保留未消费后缀，clear 只重置状态而不擦除内容。slice/duplicate 可共享底层存储但有独立位置状态，不能因视图不同就认定数据线程安全；direct buffer 也不保证端到端零复制。',
'epoll 触发模式与就绪处理':'LT 在条件持续满足时仍可报告就绪；ET 依赖状态变化，通常配合非阻塞描述符处理到 EAGAIN。若为公平性提前用尽本轮预算，应保留软件就绪状态继续调度，不能只等待一个可能不再出现的新边沿。EOF、错误和部分写都属于状态机分支。',
}
for label,body in add.items():
 old=f'<p class="md-p">{label}</p>';fix(id,p,old,old+f'<p class="md-p">{body}</p>','Replace topic-only appendix with concrete mechanism and limits; retain original label and anchor.')
# Explicit scope applies to remaining source-index labels, which retain their preceding detailed contracts.
old='<p class="md-p">本地实验的构建与回收边界</p>'
fix(id,p,old,old+'<p class="md-p">以上保留原练习的主题、限制和验证目标；本页没有附齐可运行源码与驱动，也没有执行结果。准备实验时先核验完整源文件与依赖，再使用独立构建目录、回环端点和资源期限，退出后回收本次创建的进程、端口及临时文件。</p>','Close appendix with honest source and execution boundary.')
composed={k:copy.deepcopy(v['entry']) for k,v in b.items()};checks=[];spans=[]
for x in out:
 assert get(b[x['entryId']]['entry'],x['path'])==x['before'];assert h(x['before'])==x['beforeSha256'];assert h(js(b[x['entryId']]['entry']))==x['entryBeforeSha256'];assert h(x['after'])==x['afterSha256']
 retention={}
 for name,pat in [('links',r'href="[^"]+"'),('anchors',r'id="[^"]+"'),('images',r'<img\b[^>]*>'),('code',r'<(?:pre|code)\b.*?</(?:pre|code)>')]:
  aa=re.findall(pat,x['before'],re.S);zz=re.findall(pat,x['after'],re.S);assert aa==zz,(x['entryId'],name);retention[name]=len(aa)
 nums=lambda s:set(re.findall(r'(?<!\w)\d+(?:\.\d+)*',s))
 checks.append(dict(entryId=x['entryId'],path=x['path'],guards=True,retained=retention,numericRemoved=sorted(nums(x['before'])-nums(x['after']))))
 put(composed[x['entryId']],x['path'],x['after'])
 for tag,a,z,c,d in difflib.SequenceMatcher(None,x['before'],x['after'],autojunk=False).get_opcodes():
  if tag!='equal':spans.append(dict(entryId=x['entryId'],path=x['path'],type=tag,beforeSpan=[a,z],afterSpan=[c,d],before=x['before'][a:z],after=x['after'][c:d]))
entries=[];catalog=json.loads(Path('site/notes-58c0-refactor/dist/data/catalog.json').read_text());ids={c['id']for c in catalog['entries']};links=[]
for k,a in composed.items():
 old=b[k]['entry'];assert len(a.get('items',[]))==len(old.get('items',[]))
 for q,q0 in zip(a.get('items',[]),old.get('items',[])):
  for f in q0:
   if f not in ['a','lead']:assert q[f]==q0[f]
  if q.get('leadType')=='authored':assert q['a'].startswith(q['lead'])
 live=next(e for e in json.loads(Path(b[k]['source']).read_text())['entries'] if e['id']==k);assert live==old,k
 for ref in re.findall(r'href="([^"]+)"',js(a).replace('\\"','"')):
  if ref.startswith('#/e/'):
   target=ref[4:].split('?')[0].split('#')[0].split('/')[0];assert target in ids,(k,ref);links.append(dict(entryId=k,href=ref,targetExists=True))
 entries.append(dict(entryId=k,questions=len(a.get('items',[])),liveMatchesFrozen=live==old,preflightMatches=b[k]['preflightMatches'],identityAndQuestionOrder=True,authoredPrefixes=True,beforeSha256=h(js(old)),afterSha256=h(js(a))))
archives=[]
for a in load('input/primary-source-audit.json')['localArchives']:
 assert h(Path(a['path']).read_bytes())==a['sha256'];archives.append(a)
for n,d in [('approved-leaves.json',out),('additional-composition.json',changes),('composed-entries.json',composed),('mechanical-checks.json',checks),('entry-retention-proof.json',entries),('composed-source-span-map.json',spans),('link-checks.json',links),('archive-checks.json',archives)]: (P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
print('Validated',len(out),'leaves',len(changes),'extra edits',len(links),'internal links',sum(e['questions']for e in entries),'questions')
