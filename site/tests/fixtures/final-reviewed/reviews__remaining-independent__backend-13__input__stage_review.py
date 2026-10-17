import json,hashlib,re,copy,html,difflib
from pathlib import Path
R=Path(__file__).parent;root=R.parents[2]
h=lambda x:hashlib.sha256(x if isinstance(x,bytes) else x.encode()).hexdigest()
js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
def write(n,x):(R/n).write_text(json.dumps(x,ensure_ascii=False,indent=2))
b=json.loads((R/'live-base.json').read_text());new={k:copy.deepcopy(v['entry']) for k,v in b.items()};spans=[]
def rep(id,path,a,z,reason='Replace absent code/output or unverified run receipt with precise prose design/validation contract, preserving conditions.'):
 v=new[id]
 for k in path[:-1]:v=v[k]
 s=v[path[-1]];assert a in s,(id,path,a)
 spans.append(dict(entryId=id,path=path,before=a,after=z,beforeSha256=h(a),afterSha256=h(z),occurrences=s.count(a),reason=reason));v[path[-1]]=s.replace(a,z)
def q(id,i,a,z):rep(id,['items',i,'a'],a,z)
for id,e in new.items():
 for i,item in enumerate(e.get('items',[])):
  plain=re.sub(r'^<p[^>]*><span[^>]*>本质</span>|</p>$','',item.get('lead',''));dup='<p class="md-p">'+plain+'</p>'
  if plain and dup in item['a']:rep(id,['items',i,'a'],dup,'','Remove only exact duplicate authored-lead paragraph; preserve unique facts and variant headings.')
def lead(id,i,body):
 old=new[id]['items'][i]['lead'];z='<p class="md-p sx-ess"><span class="sx-tag">本质</span>'+body+'</p>';rep(id,['items',i,'lead'],old,z,'Answer the complete question in the first sentence.');q(id,i,old,z)
lead('own-os-sandbox',0,'reset 通过隔离旧任务并恢复明确的初始状态，让下一次运行可比较；replay 通过带版本与顺序的事件记录解释运行过程，必须区分不产生副作用的离线回放和重新执行。')
lead('own-os-protection',1,'硬件 IRQ 处理从中断路由与保存现场开始，经向量入口和驱动确认事件，必要时交给适合上下文的延后处理，再唤醒等待者并恢复执行；唤醒不保证原任务立即获得 CPU。')
lead('own-os-protection',5,'按键先成为设备与输入事件，经焦点、布局和输入法生成文本；图形终端还经 PTY/TTY 与回显，最终由终端或应用渲染并交显示系统形成像素。')
q('own-os-process',3,'官方当前init/main.c的rest_init','Linux v6.12 的 init/main.c 中 rest_init')
q('own-os-process',0,'给完整TaskGroup/取消代码和阻塞演示。','解释 TaskGroup 的取消协议与阻塞验证条件。')
q('own-os-process',1,'生产代码还需完整错误清理与健壮资源封装，本例断言用于自包含测试。','生产实现还需完整错误清理与健壮资源封装；自包含测试可用断言核对上述 FD 生命周期，但断言不能替代生产错误处理。')
q('own-os-memory',1,'OS页分配器管理物理页，slab类缓存把页分成小对象，语言分配器再管理用户对象，三者处于不同层。','OS 页分配器管理物理页，内核 slab 类缓存从页分配小对象；用户态语言分配器通过虚拟内存接口管理用户对象，并不是在内核 slab 对象之上直接分配。')
# Keep authored lead consistent after scope correction.
rep('own-os-memory',['items',1,'lead'],'OS页分配器管理物理页，slab类缓存把页分成小对象，语言分配器再管理用户对象，三者处于不同层。','OS 页分配器管理物理页，内核 slab 类缓存从页分配小对象；用户态语言分配器通过虚拟内存接口管理用户对象，并不是在内核 slab 对象之上直接分配。','Clarify that user allocator is not directly layered on kernel slab.')
q('own-os-memory',3,'当前代码没有在锁外复制再盲写覆盖','该协议不允许在锁外复制再盲写覆盖')
q('own-os-memory',3,'代码拒绝null键/值','接口应拒绝 null 键/值')
for a,z in [
('保留各语言原生接口和完整示例','保留各语言原生接口、语义例子和验证条件'),
('一个完整C++17例子','C++17 的类型推导验证'),
('这个例子把待推导函数的定义放在调用之前，并用static_assert检查副本、引用和两种花括号写法。','验证时应把待推导函数的定义放在调用之前，并用 static_assert 检查副本、引用和两种花括号写法。'),
('完整手写实现和不变量','手写实现应维护的不变量'),
('shared_weak.cpp用控制块mutex保护strong和weak','可将手写模型命名为 shared_weak.cpp，用控制块 mutex 保护 strong 和 weak'),
('该版本仅支持','这个教学子集仅支持'),
('下面是 C++17 完整例子。无参和单参构造都委托给双参构造','以 C++17 的 Point 模型说明：无参和单参构造都委托给双参构造'),
('输出依次是 0,0、3,0、3,4、3,4。','假设依次创建 Point a、Point b(3)、Point c(3,4)、Point d=c，且坐标缺省为 0，则坐标依次为 0,0、3,0、3,4、3,4；这是语义推导。'),
('下面用不同参数类型合法重载，验证整数实参仍选 int 版本，即使结果存入 double。','例如合法重载 f(int) 与 f(double)，整数实参仍选择 int 参数版本，即使结果存入 double。'),
('可按 C++17 编译并运行这个例子；','可按 C++17 为这一规则准备独立验证；'),
('<p class="md-p">输出：</p>','<p class="md-p">以 Combined(Left, Right)、Left 和 Right 均继承 Base 的协作式菱形模型说明，MRO 为 Combined、Left、Right、Base、object。</p>'),
('输出为 parent:task:level=2。','若父类 describe 返回 parent:task，子类以 super.describe() 取得它，再拼接 level=2，则可推导结果 parent:task:level=2；这一结果依赖该明确的方法合同。'),
('Lua 5.4 的有限教学断言覆盖','Lua 5.4 的有限教学断言应覆盖'),
('可在独立Lua 5.4进程中执行该文件','可在独立 Lua 5.4 进程中设计并执行上述可达性实验'),
('下面用最小字段登记例子演示机制','可用最小字段登记模型说明机制'),
('阅读代码时重点区分','实现和验证时重点区分'),
('virtual_layout.cpp用Left/Right/Derived测试','可设计 virtual_layout.cpp，用 Left/Right/Derived 测试'),
('示例没有别名违规地读取vptr，没有对多态类用不合适offsetof，也没有故意通过无虚析构基类执行错误delete。','验证不能通过别名违规读取 vptr、对多态类误用 offsetof，或故意通过无虚析构基类执行错误 delete 来取得结果。'),
('完整 C++17 例子与检查','C++17 验证应覆盖的规则'),
('下面包含初始化、两类可变参数、引用折叠/转发、复制赋值与返回值消除的完整独立程序。','可分别准备独立检查，覆盖初始化、两类可变参数、引用折叠/转发、复制赋值与返回值消除。'),
('下面的向下转换安全依赖','这一模型的向下转换安全依赖'),
('spsc_ring.cpp只有生产者写tail','可将 SPSC 模型命名为 spsc_ring.cpp：只有生产者写 tail'),
('代码使用环内有限索引','该模型使用环内有限索引'),
('样例测试重试循环的等待成本另算','验证时重试循环的等待成本另算'),
('完整原生实现的状态不变量','原生对象池的状态不变量'),
('object_pool.cpp的LocalPool&lt;T,N&gt;用','可将模型命名为 object_pool.cpp，其中 LocalPool&lt;T,N&gt; 用'),
('外来handle、重复释放和构造异常都有测试。','外来 handle、重复释放和构造异常都应有对应测试。'),
('示例LockedPool就是这样包装','LockedPool 可按此方式包装'),
('该实现只管理固定类型','这个设计只管理固定类型'),
('bss_probe.c声明1MiB','可设计 bss_probe.c，声明 1MiB'),
('测得段大小包含','实际测得的段大小可能包含'),
('题目位于C++客户端手撕环节，提供原生C++17代码。','题目位于 C++ 客户端手撕环节，这里按 C++17 说明初始化与生命周期合同。'),
('示例Retry展示第一次抛异常、第二次成功。','Retry 验证模型可让第一次抛异常、第二次成功，检查语言规定的重试行为。'),
('示例increment/count使用同一mutex保护字段','increment/count 接口可使用同一 mutex 保护字段'),
('singleton.cpp用8个真实线程同时经过get，验证同一地址、构造计数1及8000次受保护更新，再验证失败初始化重试。','可设计 singleton.cpp，让 8 个真实线程同时经过 get，核对同一地址、构造计数 1 及 8000 次受保护更新，再验证失败初始化重试；这些是验证目标。'),
('完整原生转换、虚析构和ABI布局示例已在','原生转换、虚析构和 ABI 布局机制见'),
('不重复生成另一份同题实现。','具体布局仍需按目标 ABI 与构建核对。'),
('三个link示例文件由GCC14.2以C++17、O0和保留帧指针编译，1000次七整数参数调用均返回正确值。实际汇编看到前六寄存器、第七参数位于16(%rbp)、返回值rax与ret；这是该构建的观察，不是要求所有优化编译都长这样。','可为 link 模型准备三个源文件，以 GCC 14.2、C++17、O0 和保留帧指针的条件检查 1000 次七整数参数调用。若采用常见 push rbp/mov rsp,rbp 序言，第七个简单整数参数可在 16(%rbp) 读取，前六个走相应参数寄存器，简单整数返回值走 rax，普通返回用 ret；实际汇编仍须验证，不能把这组条件当成已运行记录或所有优化构建的固定布局。'),
('给出合法动态转换与析构的完整示例','解释合法动态转换与析构机制'),
('完整示例与接口边界','跨文件链接的验证方案'),
('nm -C在main对象中看到未定义sum7，readelf -r看到对应重定位，objdump -d -C观察链接后调用和返回。','验证时可用 nm -C 检查 main 对象中尚未定义的 sum7，用 readelf -r 检查对应重定位，再用 objdump -d -C 观察链接后调用和返回；这些是待检查的证据点。'),
('该实现close幂等','这一队列协议中 close 幂等'),
('本册的IntQueue/BoundedIntQueue示例没有这些统计字段','上述 IntQueue/BoundedIntQueue 基础协议不包含这些统计字段'),
('两个完整C文件分别定义同名内部helper，另一公开变量通过extern使用，函数局部counter连续1000次保留递增值。','可用两个 C 文件分别定义同名内部 helper，让另一公开变量通过 extern 使用，并连续 1000 次调用函数局部 counter 检查保留递增值。'),
('完整Linux FD示例及边界','Linux FD 所有权模型及边界'),
('100轮均在栈展开后以fcntl确认两个旧FD为EBADF。严格C++17和ASan/UBSan验证有限路径，没有监听真实网络、关闭外部FD或测试所有系统错误。','可设计 100 轮受控检查，在栈展开后以 fcntl 检查两个已关闭且未被复用的旧 FD 是否为 EBADF；再用严格 C++17 和 ASan/UBSan 检查有限路径。测试只应使用自己创建的 FD，不能把这一计划当成已完成运行或所有系统错误的覆盖证据。'),
('完整LocalPool/LockedPool处理','LocalPool/LockedPool 设计需处理'),
('mathlib.c定义add42，usemath.c调用1000组值并断言结果。','可让 mathlib.c 定义 add42，并让 usemath.c 对 1000 组值调用并断言结果。'),
('readelf -d保存动态依赖，nm保存静态可执行符号与共享对象导出，验证一个自有库的两条路径。','验证时用 readelf -d 保存动态依赖，用 nm 保存静态可执行符号与共享对象导出，核对一个自有库的两条路径。'),
('它只形成合法尾后指针，不解引用尾后位置，也不故意执行未定义行为。','指针验证只应形成合法尾后指针，不解引用尾后位置，也不故意执行未定义行为。')]:rep('own-os-memory',['readingNotesHtml'],a,z)
for a,z in [
('async_tools.py先验证','可设计 async_tools.py，先验证'),('代码因此保留任务句柄','该设计因此应保留任务句柄'),('本示例只调用本地测试协程，没有真实支付/数据库/模型。','验证应先使用本地测试协程，不将这套协议推导当作真实支付、数据库或模型集成结果。'),('本例只使用有限本地协程与线程','上述验证限定为有限本地协程与线程'),
('python_memory.py用weakref观察','可设计 python_memory.py，用 weakref 观察'),('示例未启用它。','下述推演以不启用它为前提。'),
('async_steps.py在默认CPython3.12.14跑100轮，验证','可设计 async_steps.py，在默认 CPython 3.12.14 中跑 100 轮，核对'),
('interpreter_probe.py对固定自编写片段','可设计 interpreter_probe.py，对固定自编写片段'),('这个实验只编译固定教学片段','这一验证方案只编译固定教学片段'),
('完整Python固定池把运行数和待执行数分别约束','Python 固定池应分别约束运行数与待执行数'),('bounded_pool.py用固定非daemon工作者','可设计 bounded_pool.py，使用固定非 daemon 工作者'),('测试工作均有自己的Event等待上限','测试工作应各有自己的 Event 等待上限')]:rep('own-os-process',['readingNotesHtml'],a,z)
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
