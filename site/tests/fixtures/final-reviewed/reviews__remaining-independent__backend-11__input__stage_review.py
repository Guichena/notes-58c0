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
q('own-mysql-ch27',0,'块尾不足七字节时还有填充规则，因此一个物理片段的 payload 并不等于整个 block 的大小。','块尾不足七字节时用零填充；若恰好剩七字节且新逻辑记录非空，LevelDB 1.23 会先写一个零载荷 FIRST，再把数据写到后续块。这是该格式的边界规则，不适用于下面禁止空分片链的教学协议。物理片段的 payload 因而不等于整个 block 的大小。')
q('own-mysql-ch27',0,'本文下面的 Java 模型','这里讨论的 Java 教学模型')
q('own-mysql-ch27',0,'使用完整 JDK 21，在保存文件的目录执行：','实现验证器时使用完整 JDK 21，并单独准备已审阅的源文件和入口。')
q('own-mysql-ch27',0,'也可先编译后运行；若环境只有 java 命令但带有 JDK 编译器模块，可执行：','可选择先编译后运行，或在确有 JDK 编译器模块时采用相应源文件启动方式；只有 java 命令存在并不证明具备编译环境。')
q('own-mysql-ch27',0,'测试入口固定随机种子，进行 400 组随机输入','验证方案应固定随机种子，覆盖 400 组随机输入')
q('own-mysql-ch27',0,'非法长度、类型、链顺序、校验和资源上限另有断言。失败会抛出异常并以非零状态退出，正常结束打印检查数量。','还应对非法长度、类型、链顺序、校验和资源上限设置断言；验证器应在失败时以非零状态退出，正常结束时记录检查数量。')
q('own-mysql-ch27',0,'测试中的 Arrays.copyOf(log, validBytes) 只是构造新的内存前缀来复查扫描结果。','验证时可复制 log 的前 validBytes 字节，构造新的内存前缀来复查扫描结果。')
q('own-mysql-ch27',0,'本实现没有事务提交记录','这一帧协议没有事务提交记录')
q('own-mysql-ch32',0,'代码只验证位宽和组合身份','本地模型只负责验证位宽和组合身份')
q('own-mysql-ch32',0,'实际Java合并验证','Java 合并模型与验证条件')
q('own-mysql-ch32',0,'ColdMerge接收已经在同一水位可读的两份版本历史','可把参考算法命名为 ColdMerge，输入为已经在同一水位可读的两份版本历史')
q('own-mysql-ch32',0,'代码包含水位、重复、删除、旧状态过滤反例、跨租户、游标、零页、冲突和100种输入排列测试。','验证清单应包含水位、重复、删除、旧状态过滤反例、跨租户、游标、零页、冲突和 100 种输入排列；这些是应覆盖的用例，不是本页已经运行的结果。')
q('own-mysql-ch34',1,'该教学设计以 MySQL 8.4.0 DDL 与 JDBC 参数模板为条件，未执行。带 ? 的语句必须分别 prepare 和绑定，不能把整个文件当作 mysql 客户端批处理脚本。','该教学设计以 MySQL 8.4.0 和 JDBC 参数化执行为条件。若另行准备 DDL 与参数模板，带 ? 的语句必须分别 prepare 和绑定，不能作为 mysql 客户端批处理脚本执行；这里解释约束，不承诺附有可直接运行的文件。')
q('own-mysql-ch35',2,'下面的 iot_batch.py 是独立 Python DB-API 教学模型：','可设计独立 Python DB-API 教学模型 iot_batch.py，明确这些输入约束：')
q('own-mysql-ch35',2,'它用 SQLite 说明关系协议','该模型可用 SQLite 说明关系协议')
q('own-mysql-ch35',2,'IoT 批处理教学模型以 CPython 3.12.0 为条件，只创建进程内 SQLite 内存库。init 仅用于空库；batch/publish 要求','IoT 批处理教学模型以 CPython 3.12.0 为条件，可先用进程内 SQLite 内存库验证关系规则。init 应仅用于空库；batch/publish 应要求')
q('own-mysql-ch35',2,'重开进程后的已提交数据，以及拒绝错误事务模式时连接仍空闲；这些条件不能用两条样本的演示 main 代替。','重开进程后的已提交数据，以及拒绝错误事务模式时连接仍空闲；重开验证必须另用独立文件库，因为进程内内存库退出后不会保留数据。这些条件不能用两条样本的演示代替。')
q('own-mysql-ch37',0,'2. 一个完整、可运行的受限 DSL 编解码器','2. 受限 DSL 编解码协议与验证范围')
q('own-mysql-ch37',0,'下面明确选择一种教学二进制树协议','这里明确选择一种教学二进制树协议')
q('own-mysql-ch37',0,'本实现只编解码','这个模型只讨论编解码')
q('own-mysql-ch37',0,'它覆盖 Unicode','验证应覆盖 Unicode')
# Remove exact duplicated lead paragraphs only, and repeated unanchored adjacent headings.
for id,e in new.items():
 for i,item in enumerate(e.get('items',[])):
  lead=item.get('lead','');plain=re.sub(r'^<p[^>]*><span[^>]*>本质</span>|</p>$','',lead)
  dup='<p class="md-p">'+plain+'</p>'
  if plain and dup in item['a']:rep(id,['items',i,'a'],dup,'','Exact duplicate of authored lead; no unique knowledge removed.')
 for field in ['html']:
  if field in e:
   pattern=r'(<h([1-6])\b[^>]*>[^<]*</h\2>)(<h\2\b[^>]*>[^<]*</h\2>)'
   while True:
    matches=list(re.finditer(pattern,e[field]));found=False
    for m in matches:
     if re.sub('<[^>]*>','',m[1])==re.sub('<[^>]*>','',m[3]) and ' id=' not in m[3]:rep(id,[field],m[0],m[1],'Adjacent duplicate heading; anchored heading and all knowledge retained.');found=True;break
    if not found:break
p=['readingNotesHtml'];id='own-network-transport'
for a,z in [('完整练习','练习合同'),('完整对照','状态对照'),('完整离线驱动','离线验证范围'),('完整本地驱动','本地验证范围'),('全部练习的运行入口','练习环境与构建隔离'),('与前面的 BoundedFrameDecoder 保存到同一目录，驱动覆盖确定性切片、非法长度、EOF、预算与时钟。它只使用本地字节，不验证真实链路或业务提交。','若实现 BoundedFrameDecoder 的配套驱动，应独立组织源文件，覆盖确定性切片、非法长度、EOF、预算与时钟。纯本地字节验证不证明真实链路或业务提交。'),('此驱动与 poll_echo.cpp 放在同一目录，先把服务编译为 build/poll_echo；所有连接都发往 127.0.0.1。','若准备 poll_echo.cpp 与配套驱动，可放在同一独立练习目录，服务产物限定为 build/poll_echo；所有测试连接都应发往 127.0.0.1。')]:rep(id,p,a,z)
id='own-network-source-guide';p=['html']
for a,z in [('源码按 transport/code/ 与 application/code/ 分开保存和编译；即使类名相同，也不要把两组 Java 文件合并到一个源码目录。从解压后的包根目录分别运行：','原配套源码按 transport/code/ 与 application/code/ 分组；若另行取得并核验完整源包，应分别保存和编译，即使类名相同也不能合并到同一源码目录。这里保留目录约定，不提供缺失的运行命令。'),('保存文件为 application/code/ 下的相应名称后，从本书包根目录运行 bash application/code/run-local-tests.sh；编译输出写入 application/private/build/，与传输篇相互独立。','原应用篇约定源码位于 application/code/，入口名为 run-local-tests.sh，构建产物位于 application/private/build/，与传输篇独立。只有取得并核验完整源包、依赖和隔离条件后才可运行相应入口；理论页不是源码包。')]:rep(id,p,a,z)
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
