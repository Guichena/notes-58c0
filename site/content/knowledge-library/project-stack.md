# 项目技术栈与中间件八股（三段经历串联）

本专题把三段核心经历（`NoteWeave｜AI 资料研究工作台`、`制造业生产事件可靠触达与智能维修平台`、`TencentDB Agent Memory`）涉及的后端与 AI Agent 技术栈收在一页，结合站内高频考点补齐底层机制、参数边界、系统设计权衡与面试现场口述表达。支持按技术域与关联经历筛选，也可开启背诵遮挡自测。

围绕简历中的 `Spring Boot / MySQL / Redis / Kafka / RabbitMQ / PostgreSQL（pgvector）/ RAG / MCP / Agent Evaluation / MemoryProxy` 等关键词展开，保留常见后端八股、项目结合和面试追问，不做跨页跳转。

## 一、并发容器、JUC 并发、JVM、Spring 与网络 IO 考点

### 1.1 哈希集合、并发容器与本地缓存底层（`HashMap` · `ConcurrentHashMap` · `Caffeine`）

#### 1. 核心定位与常考主线

后端面试必考基础数据结构与高并发内存容器：`HashMap` 为什么非线程安全且扩容怎么省掉重算哈希？`ConcurrentHashMap` 怎么把锁粒度压到单桶并实现多线程协助扩容与无伪共享计数？为什么项目本地缓存不用裸 `ConcurrentHashMap` 而选 `Caffeine (W-TinyLFU)`？

#### 2. 底层机制与高频考点

* **`HashMap`（JDK 1.8+）三大核心机制**：

  1. **高低 16 位异或扰动**：`(h = key.hashCode()) ^ (h >>> 16)`，因初始桶数组较小，取模 `(n - 1) & hash` 仅看低位，异或将高 16 位特征混入低 16 位以减少哈希冲突。

  2. **尾插法 + 红黑树双阈值**：改 1.7 头插法为尾插法消除并发扩容环形死链（但多线程并发 `put` 仍会因同槽判断后相互覆盖导致丢数据，严禁并发裸用）；**链表长度 `>= 8` 且桶数组容量 `>= 64` 才转红黑树**（若数组 `< 64` 优先触发 `resize()` 扩容而非树化），红黑树节点删减至 **`<= 6`** 时退化回链表（中间留 `7` 作迟滞缓冲，防止在阈值边缘频繁增删引发树与链表反复转换抖动）。

  3. **2 倍扩容位运算免重算哈希**：容量恒为 `2^k`，扩容翻倍后仅掩码最高位多出一个 `1`，直接检测 `(e.hash & oldCap) == 0`，为 `0` 留原下标 `j`，非 `0` 移至 `j + oldCap`，O(1) 位运算拆成高低两条链。

* **`ConcurrentHashMap`（JDK 1.8+）并发控制与多线程协迁**：

  1. **锁粒度细化至桶头**：废弃 1.7 的 `Segment` 分段锁（继承 `ReentrantLock`，默认并发度固定 16），改用 `Node[] + CAS + synchronized`。定位到空桶时用 **`CAS` 无锁写入**新节点；非空桶冲突时用 **`synchronized` 仅锁当前桶头节点**，锁粒度随数组扩容自动变细。

  2. **多线程协助扩容（`ForwardingNode`）**：扩容新建 `nextTable`，线程按 `stride` 步长（最小 16 个桶）领迁移任务；某旧桶迁完后放入 `hash = -1 (MOVED)` 的 `ForwardingNode`，读请求遇到它直接转发查新表不阻塞，写请求遇到它主动加入协助搬迁。

  3. **分片计数消除伪共享（False Sharing）**：效仿 `LongAdder`，维护 `volatile long baseCount` 加 `@jdk.internal.vm.annotation.Contended CounterCell[]`（自动填充字节凑够独占 **`64 Bytes` CPU 缓存行**，防止多核高频修改相邻数组元素引发 `MESI` 缓存行反复失效），`size()` 汇总 `baseCount` 与全部 `CounterCell`。

* **高频补充：`0.75` 负载因子、`ConcurrentHashMap` 禁 `null` 与无锁读**：

  1. **为什么默认负载因子是 `0.75`？** 在空间利用率与哈希冲突概率之间做折中：`0.5` 扩容过早浪费一半桶数组，`1.0` 冲突陡增链表变长；`0.75` 下按泊松分布推算，单个桶链长达到 `8` 的概率不到千万分之一（`0.00000006`），正常情况下几乎不触发树化，树化本质是防御哈希碰撞攻击的兜底。

  2. **为什么 `ConcurrentHashMap` 禁止 `null` 键和 `null` 值？** 在单线程 `HashMap` 里，`get(k) == null` 可以靠再调一次 `containsKey(k)` 区分「键不存在」还是「值本身是 `null`」；但多线程并发下，这两次调用之间可能被其他线程插入或删除该键，语义产生二义性，因此并发集合直接禁止 `null`。

  3. **为什么 `ConcurrentHashMap.get()` 全程无需加锁？** `Node` 节点的 `val` 与 `next` 指针以及桶数组 `table` 均用 `volatile` 修饰，结合扩容时 `ForwardingNode` 转发读取新表，保证读线程天然看到最新已发布写入。

* **本地缓存演进：`Caffeine`（`W-TinyLFU`）为什么优于裸 `ConcurrentHashMap` 与纯 `LRU`？**

  * 裸 `ConcurrentHashMap` 无容量上限与过期淘汰策略，长期写入必引发老年代 OOM；传统纯 `LRU` 遇到一次偶发批量冷数据扫描就会把真正高频访问的热点键挤出缓存（缓存污染）。

  * `Caffeine` 底层基于 `ConcurrentHashMap` 存储，前置 `1%` 容量的 `Window Eden` 区吸收突发流量，后置 `99%` 分段 `SLRU`（`20% Probation` 观察区 + `80% Protected` 保护区），并用 **`Count-Min Sketch`（每个哈希计数器仅占 `4 bit`）** 低内存近似统计历史访问频率——当观察区满需要淘汰时，新候选必须历史频率打赢受害者才准入（`TinyLFU` 准入过滤），并配合环形缓冲区（RingBuffer）异步批处理读事件减少锁竞争。

#### 3. 项目落地与跨组件系统设计权衡

* **项目落地**：Spring 启动期只读策略表（QA/Note/Wiki 检索策略、工业 LOTO/BOM 校验器）用不可变映射无锁直读；制造业 `5min` 选配子 `BOM` 一级缓存（命中率 `> 98%`）与 NoteWeave 墓碑超 `1,024` 软水位时的 `1s` 本地短缓存均采用有界 **Caffeine**。

* **对比 Redis `dict` 渐进式 Rehash**：Java `HashMap` 单次同步搬完；`ConcurrentHashMap` 靠多线程写时按步长协迁；而 Redis 命令执行主路径是单线程，千万级字典一次性迁移会卡死所有客户端几百毫秒，故用 `ht[0] + ht[1]` 双表加 `rehashidx` 游标分摊到每次增删改查和定时事件逐桶搬迁（参考 [Redis 7.2 dict.c](https://github.com/redis/redis/blob/7.2.4/src/dict.c)）。

#### 4. 面试口述与连环追问

> **【面试口述】**`HashMap` 1.8 用高低 16 位异或降冲突，改尾插消死链，链长满 `8` 且数组容量满 `64` 才转红黑树、降到 `6` 退化防抖动，二倍扩容靠 `hash & oldCap` 位运算直接拆成原位和加旧容量两条链。多线程下它并发写会覆盖丢数据，生产我用 `ConcurrentHashMap`：1.8 弃用 `Segment` 分段锁改为『空桶 `CAS` + 非空 `synchronized` 锁桶头』，扩容完的桶放 `MOVED` 转发节点让写线程按步长协助迁移，计数用 `@Contended` 填充 64 字节缓存行的 `CounterCell` 数组消除伪共享。而在制造业子 `BOM` 一级缓存和 NoteWeave 墓碑 1 秒短缓存里，我没有裸用无容量上限的 `ConcurrentHashMap`，而是用它之上的 `Caffeine`，靠 `4-bit Count-Min Sketch` 的 `W-TinyLFU` 准入机制防低频扫描污染热数据。

* **追问：为什么 `ConcurrentHashMap` 在 JDK 1.8 里放弃了 `ReentrantLock` 分段锁，改用 `synchronized` 锁桶头？难道 `synchronized` 不重吗？**

  > **答**：两点核心收益。第一是锁粒度和内存开销：1.7 的 `Segment` 继承自 `ReentrantLock`，默认并发度创建后就死锁在 16 无法随扩容增长，且每个分段都要维护一套独立对象结构。1.8 直接锁链表头或红黑树根节点，数组扩到几千桶并发度就自动扩到几千，且单桶冲突概率本就很低。第二是 JVM 层面对 `synchronized` 做了深度锁升级优化，绝大多数低竞争碰撞在用户态栈帧 `CAS` 轻量级锁和自适应自旋阶段就化解了，极少真正膨胀为内核态 `ObjectMonitor`，而且 JVM 原生支持锁粗化与锁消除，综合内存和吞吐反而优于每个桶塞一个 `ReentrantLock` 实例。

### 1.2 JUC 锁体系、`有界线程池`（`ThreadPoolExecutor`）与 `CompletableFuture` 异步编排

#### 1. 核心定位与常考主线

简历在制造业职责 4 明确写了「**采用有界线程池并发执行**」，在 NoteWeave 中多处涉及双路并行召回、SSE 阻塞读池与 Kafka 产物消费池。面试必考 `synchronized / volatile / AQS` 锁底层、线程池七参数与拒绝策略陷阱、异步饥饿死锁、虚拟线程边界与 `traceId` 透传。

#### 2. 底层机制与高频考点

* **`synchronized` 锁升级、`volatile` 与 `AQS / ReentrantLock`**：

  * **`synchronized` 锁升级路径**：现代多线程池化应用中，早期针对单线程无竞争设计的偏向锁会频繁触发昂贵的全局安全点（`SafePoint`）暂停撤销，故 JDK 15+ 默认废弃偏向锁（参考 [OpenJDK JEP 374](https://openjdk.org/jeps/374)），直接沿「无锁 → 轻量级锁（当前线程栈帧建 `Lock Record`，通过 `CAS` 将对象头 `Mark Word` 替换为锁记录指针，轻微竞争走自适应自旋）→ 重量级锁（膨胀为 C++ `ObjectMonitor`，挂起线程切换内核态）」升级。

  * **`volatile` 两大硬件级语义**：① **可见性**：写操作插入 `lock` 前缀指令（充当最重的 `StoreLoad` 内存屏障），将 CPU Store Buffer 刷回缓存并经 `MESI` 协议使他核缓存行失效；② **禁止指令重排**：阻断 DCL 双重检查锁单例 `instance = new Singleton()` 从「分配内存 → 初始化对象 → 引用指向内存」重排为「1 → 3 → 2」导致其他线程拿到半初始化对象逃逸。`volatile` 不保证 `count++` 复合操作原子性。

  * **`AQS`（AbstractQueuedSynchronizer）与 `ReentrantLock`**：核心是 `volatile int state`（`ReentrantLock` 记重入次数，`Semaphore` 记剩余许可数，`CountDownLatch` 记倒计数）+ CLH 变体双向等待队列 + `LockSupport.park()/unpark()`。`ReentrantLock` 默认非公平锁，进门直接 `CAS(0, 1)` 抢锁减少上下文切换故吞吐更高；公平锁先调 `hasQueuedPredecessors()` 检查前驱防饥饿，且相比 `synchronized` 额外支持可中断获取（`lockInterruptibly`）、超时获取（`tryLock(timeout)`）与绑定多个 `Condition` 条件队列。

* **`ThreadPoolExecutor` 七大参数与任务提交流程**（参考 [Java 21 ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)）：

  * **七参数**：`corePoolSize`（核心线程数）、`maximumPoolSize`（最大线程数）、`keepAliveTime`（非核心空闲存活时长）、`unit`（时间单位）、`workQueue`（阻塞队列）、`threadFactory`（命名线程工厂，出问题 `jstack` 一眼定位模块）、`handler`（拒绝策略）。

  * **铁律顺序**：提交任务 → `< corePoolSize` 则新建核心线程 → 否则尝试**先入 `workQueue` 队列** → **只有队列满了**才新建非核心线程扩至 `maximumPoolSize` → 队列与最大线程全满才触发拒绝策略（因此使用默认 `Integer.MAX_VALUE` 的无界 `LinkedBlockingQueue` 时，`maximumPoolSize` 形同虚设，流量洪峰直接堆爆老年代 OOM）。

  * **四种内置拒绝策略与致命陷阱**：

    1. `AbortPolicy`（默认）：直接抛 `RejectedExecutionException`，调用方可捕获感知过载并做持久化兜底。

    2. `CallerRunsPolicy`：池未关闭时**由提交任务的线程亲自同步执行**。**大坑**：若提交者是 Tomcat 主请求线程、Netty `EventLoop` 或 Kafka `poll` 拉取线程，而任务是耗时 `7.5s` 的大模型调用，提交线程会被直接卡死 `7.5s`，轻则拖垮上游接口吞吐，重则导致 Kafka 超过 `max.poll.interval.ms` 触发全组重平衡风暴。

    3. `DiscardPolicy` / `DiscardOldestPolicy`：静默丢弃当前或队首任务，在可靠任务或手动提交位点场景会造成静默丢单。

* **高频补充：`ctl` 状态位、线程数估算、`execute` vs `submit` 与虚拟线程 Pinning**：

  1. **`ctl` 32 位原子状态**：高 `3` 位存线程池生命周期状态（`RUNNING / SHUTDOWN / STOP / TIDYING / TERMINATED`），低 `29` 位存工作线程数，一次 `CAS` 即可同时核验状态与增减计数，避免双变量竞态。

  2. **线程数工程估算**：CPU 密集型按 `N + 1`（`+1` 兜底偶发缺页或调度空档，再多只会放大上下文切换）；IO 密集型理论按 `N × (1 + 等待耗时 / 计算耗时)`，工程上通常从 `2N ~ 4N` 起步压测收敛，并且必须以下游数据库/连接池/GPU 配额作为硬上限。

  3. **`execute()` vs `submit()` 异常吞没陷阱**：`execute()` 抛出未捕获异常会直达 `UncaughtExceptionHandler` 并打印栈；`submit()` 会把异常封装进返回的 `Future` 对象，如果调用方不调 `future.get()`，线上异常会被彻底静默吞掉。

  4. **虚拟线程 Pinning（固定载体线程）边界**：在 JDK 21~23 中，若虚拟线程在 `synchronized` 同步块或 JNI 本地方法内部发生阻塞 IO，无法从载体线程卸载（Pinning），会退化占死底层 `ForkJoinPool` 线程，需改用 `ReentrantLock`（JDK 24 JEP 491 起已解除 `synchronized` 固定限制）。

* **`CompletableFuture` 父子同池饥饿死锁**：

  * **死锁时序**：有界池 `core = max = N`，瞬间涌入 `N` 个外层请求（如 NoteWeave 检索请求）占满全部 `N` 条线程；每个父任务又向**同一个线程池**提交子任务（如双路召回）并同步调 `.join()` 阻塞等待。此时 `N` 条线程全卡在 `WAITING` 等子任务完成，而队列里的子任务永远等不到空闲线程执行，CPU 跌至 0%，且因为没有传统互斥锁环，`jstack` 的常规死锁检测无法自动报出。

  * **三道铁律**：① 严禁不传 `Executor` 裸调 `supplyAsync`（默认共用全局 `ForkJoinPool.commonPool()`，会被慢 IO 一锅端）；② **父子任务物理拆分独立线程池**，尽量用 `thenCombine` 非阻塞回调串联；③ 必配 `.orTimeout(timeout, unit).exceptionally(...)` 与底层 HTTP `socketTimeout`。

* **异步线程池 `MDC / traceId` 上下文透传**：

  * `ThreadLocal` 仅当前线程可见（且线程池核心线程长期存活不退出，若 `Entry` 的弱引用 Key 被回收，强引用 Value 仍挂在 `Thread -> ThreadLocalMap` 链上引发内存泄漏，必须在 `finally` 中 `remove()`）；`InheritableThreadLocal` 只在 `new Thread()` 创建子线程那一刻复制一次，线程池复用工作线程时会导致后续请求读到旧串号 `traceId`。

  * **工程解法**：单层线程池配置 Spring `TaskDecorator`，提交任务时在主线程捕获 `MDC.getCopyOfContextMap()`，工作线程执行前**先备份工作线程原本的 `MDC`**、再写入捕获快照，`finally` 中**按备份还原**（只有备份为空才 `MDC.clear()`，防止触发 `CallerRunsPolicy` 时把调用方主线程自己的 `traceId` 误清空）；跨多层嵌套异步池则引入阿里 `TransmittableThreadLocal (TTL)` 按 `Capture-Replay-Restore` 三步透传。

#### 3. 项目落地：三套差异化线程池定参逻辑

1. **制造业 HITL 草稿生成池（`core=3, max=3, ArrayBlockingQueue(6), AbortPolicy`）**：内网单卡 A800 分给草稿硬配额共 `6` 路，双实例对等部署每机恰好 `3` 路，设 `core=max=3` 省去线程扩缩抖动；草稿任务已先落 MySQL，投进线程池的只是**不带业务 ID 的无状态唤醒信号**，工作线程跑完一单会 `while` 循环用 `SKIP LOCKED` 把库里待办拉空才退出，因此队列满触发 `AbortPolicy` 丢掉多余唤醒信号**不会丢任务**（还有 `1s` 守护线程兜底）。

2. **NoteWeave 分钟级产物消费池（`core=8, max=8, SynchronousQueue, 配合 Kafka pause/resume`）**：单任务耗时 2～6 分钟，若放在内存阻塞队列排队只会推迟执行并搞乱 Kafka 位点提交；用零容量 `SynchronousQueue`，一旦 8 线程全满，Kafka 消费线程立即调 `consumer.pause(partitions)` 停止拉新单、保持空 `poll` 续心跳，让积压安全留在 Kafka 磁盘日志里，空出线程再 `resume()`。

3. **NoteWeave SSE `XREAD BLOCK` 读池（`core=max` 或配 `SynchronousQueue`）**：阻塞读任务会长时间占住线程，若用常规有界队列，核心线程占满后新连接的读任务进了队列排死拿不到线程，前端连接就会一直收不到流式文字。

#### 4. 面试口述与连环追问

> **【面试口述】**我在两个项目里根据下游瓶颈定了不同的有界线程池。比如实习项目的维修草稿链路，内网单卡 A800 分给草稿总共 6 路并发配额，双实例部署每台配 `core=3, max=3` 加容量为 6 的 `ArrayBlockingQueue` 和 `AbortPolicy`。为什么 `AbortPolicy` 抛异常不丢单？因为任务已经先持久化进 MySQL 了，往池子里投的只是无状态唤醒信号，工作线程跑完一单会 `while` 循环 `SKIP LOCKED` 自排空待办，再加 1 秒守护线程兜底。之所以坚决不用默认的 `LinkedBlockingQueue` 是防无界堆积 OOM，不用 `CallerRunsPolicy` 是防止约 7.5 秒的慢模型推理反向把上游提交线程或调度线程卡死。另外做双路并行检索用 `CompletableFuture` 时，我专门把父编排池和子检索池物理拆开，防止高并发下父任务占满全部线程同步 `join` 等队列里的子任务，造成 CPU 利用率跌空的线程池饥饿死锁。

* **追问 1：为什么不用虚拟线程（Virtual Threads）直接替代你们制造业的 `3/3/6` 有界线程池？**

  > **答**：核心原因是系统设计的下游容量边界：虚拟线程本质是挂在 `ForkJoinPool` 载体线程上的用户态有栈协程，它只降低本机『等待网络 IO 的线程内存开销』，并不会增加下游数据库或显卡的并发承受力（参考 [Oracle Virtual Threads](https://docs.oracle.com/en/java/javase/25/core/virtual-threads.html)）。内网单卡 A800 分给草稿的并发硬配额只有 `6` 路，如果放几十个虚拟线程不加节制同时打过去，只会把 vLLM 的 `KV Cache` 塞爆触发抢占重算（Preemption），所有请求一起变慢。即便未来升到高版本用虚拟线程，也必须在外层套 `Semaphore(3)` 做并发限流背压，而对齐配额的有界线程池本身就天然兼顾了执行与硬配额准入。

* **追问 2：为什么你在 `TaskDecorator` 透传 `traceId` 的 `finally` 块里，强调要先备份工作线程原 `MDC` 再按备份还原，而不是直接调 `MDC.clear()`？**

  > **答**：这是为了防 `CallerRunsPolicy` 拒绝策略下的隐蔽串号或丢日志事故。正常异步执行时，工作线程跑完清理上下文没问题，但万一某个线程池配了 `CallerRunsPolicy`，队列满时任务是由提交任务的 Tomcat 主请求线程亲自同步执行的。如果 `finally` 里无脑调 `MDC.clear()`，子任务一跑完就会把主线程后半段还要打印的请求 `traceId` 直接抹空。先备份执行前线程手里的旧快照、跑完原样恢复，就能兼容池内工作线程和调用方回退执行两种场景。

### 1.3 JVM 内存管理、G1 巨型对象（`128 MB 流式读取`）与线上排障 SOP

#### 1. 核心定位与常考主线

NoteWeave 职责 4 明确写到：「**通过流式读取支持 128 MB 单文件异步接入**」。高频深问点：128 MB 不算几十个 G，为什么直接 `MultipartFile.getBytes()` 整包读进内存会出事故？这直接考到 G1 垃圾收集器的 `Humongous Object` 机制与堆内/堆外内存排障。

#### 2. 底层机制与高频考点

* **G1（Garbage-First）分区机制与巨型对象致命机理**：

  * G1 将整块 Java 堆切分为最多 2048 个大小相等的独立 `Region`（大小取 `1MB～32MB` 的 2 的幂），逻辑保留 Eden、Survivor、Old 角色，通过 `Remembered Set (RSet)` + 写后屏障卡表（Card Table）记录跨 Region 引用避免全堆扫描。

  * **巨型对象判定红线**：**只要单个对象的大小超过半个 Region（`> 0.5 × RegionSize`），G1 就将其判定为 `Humongous Object`**，绕过年轻代 Eden 区，直接在老年代寻找**物理连续的多个 `Humongous Region`** 分配。

  * **事故推演**：容器受限堆 `-Xms512m -Xmx512m` 下，默认 Region 仅 `1MB`（即便手动调到最大 `32MB`，半个 Region 阈值也仅 `16MB`）。`128 MB` 的 `byte[]` 远超阈值，8 路并发上传瞬间申请 `1 GB` 连续老年代空间，不仅切碎老年代造成严重外部碎片，还会频繁击穿 `IHOP` 阈值乃至分配失败，退化触发单线程/串行整理的 **Full GC** 甚至直接抛出 `OutOfMemoryError: Java heap space`。

* **三色标记并发漏标与分代 `ZGC`**：

  * 并发标记期间应用线程修改引用，漏标误回收存活白对象**当且仅当同时满足两个条件**：① **黑对象新增了指向该白对象的引用**；② **所有灰对象删除了通往该白对象的直接或间接引用**。

  * **CMS 解法（增量更新 Incremental Update）**：写后屏障拦截条件①，黑对象一旦引用白对象就把黑对象退回灰集合重新扫描（缺点是重新标记阶段需重扫整个栈与关联结构，停顿随堆变大）。

  * **G1 解法（原始快照 `SATB`，Snapshot-At-The-Beginning）**：写前屏障拦截条件②，灰对象断开白引用前把旧引用记录到 `SATB` 队列，本轮一律视作存活（会产生少量浮动垃圾留待下轮收，但重新标记极快）。

  * **Java 21 分代 `ZGC`**：采用染色指针（Colored Pointers）+ 读屏障（Load Barrier）支持并发转移整理（无需等 STW 才搬迁存活对象），分代后高频单独回收朝生夕死的年轻代，在数十 GB 大堆下将 STW 停顿压至亚毫秒级。

* **高频补充：JVM 运行时内存分区与各区 OOM 对照**：

  * **线程共享区**：**堆（Heap）**存对象实例与数组，对象泄漏或大对象分配失败报 `OutOfMemoryError: Java heap space`，持续 GC 耗时 >98% 且回收 <2% 报 `GC overhead limit exceeded`；**元空间（Metaspace，本地内存）**存类元数据与方法字节码，动态代理类（CGLIB/Groovy）无限生成且未设 `-XX:MaxMetaspaceSize` 会报 `OOM: Metaspace`。

  * **线程私有区**：**虚拟机栈**存栈帧（局部变量表、操作数栈、动态链接、方法出口），无限递归报 `StackOverflowError`，线程创建过多耗尽宿主机内存报 `OOM: unable to create native thread`；**程序计数器（PC）**记录字节码行号，是唯一不会 OOM 的区域。

* **类加载五步与三次打破双亲委派**：加载 → 验证 → 准备（普通 `static` 赋零值，`static final` 编译期字面量直接赋常量值）→ 解析 → 初始化。双亲委派自底向上检查、自顶向下加载以防核心 `java.lang.String` 被篡改；经典打破场景为 **JDBC `DriverManager`**（Bootstrap 加载器无法加载厂商驱动 Jar，借 `Thread.currentThread().getContextClassLoader()` 逆向委派 AppClassLoader）与 **Tomcat `WebAppClassLoader`**（优先自行加载当前 Web 应用依赖，隔离同容器不同版本 Spring）。

#### 3. 项目落地与五步线上排障 SOP

* **NoteWeave 双端流式卸载方案**：

  1. **上传校验侧（Java 常数堆内存）**：前端按 `8 MB` 分片直传对象存储 MinIO 并调原生 `Compose` 合并，大文件字节流根本不经过应用网关内存；Java 主控用 `try-with-resources` 打开输入流套 `DigestInputStream`，仅分配一个固定的 **`8 KB` `byte[8192]` 缓冲区**循环读取——首块比对文件头 Magic Number（魔数）防伪造后缀恶意文件，边读边累加真实长度与 `SHA-256` 哈希，`-Xmx512m` 下 8 路并发上传堆曲线平稳无巨型对象 Full GC。

  2. **解析侧（Python 微批释放）**：几百页扫描版 PDF 在无状态 Python Worker 中按 **`15 页`一个微批**流式渲染图片交 `ProcessPoolExecutor` 跑 OCR，每批结果写回 MinIO 后立即释放图像张量，内存占用仅与单批 15 页正相关，与总文件大小解耦。

* **堆内泄漏、堆外 `RSS` 暴涨与 CPU 100% 排查标准 SOP**：

  * **CPU 100% / 接口卡死五步法**：① `top -c` 定位异常 Java 进程 PID 并看 us/sy 占比；② `top -Hp <pid>` 找到高占 CPU 线程 TID；③ `printf "%x\n" <tid>` 转十六进制；④ `jstack <pid> | grep -A 30 0x<hex>` 看栈——若是 `VM Thread / GC` 线程飙高转查内存与 Full GC，若是业务 `RUNNABLE` 查死循环或灾难性正则回溯，若是**CPU 很低但接口 P99 暴涨**，统计 `WAITING / BLOCKED` 线程卡在哪个连接池（如 `HikariPool.getConnection`）或线程池阻塞调用上；⑤ 偶发毛刺挂 **Arthas** `trace` 或 `profiler` 采火焰图。

  * **堆内 vs 堆外泄漏**：`jstat -gcutil` 见 Full GC 后老年代基线单调抬升为堆内泄漏，摘流导 Dump 进 **Eclipse MAT** 对比 `Shallow Heap`（自身大小）与 `Retained Heap`（支配子树总大小）查 `Dominator Tree` 到 GC Roots 的强引用链；若堆平稳但容器因 `RSS` 超限触发 Linux OOM Killer（退出码 `137`），则是 Direct Memory、Netty 池化内存或压缩/解析库 JNI C 堆未释放，开启 `-XX:NativeMemoryTracking=detail` 对比 `jcmd <pid> VM.native_memory detail.diff` 并检查流是否全进 `try-with-resources`。

#### 4. 面试口述与连环追问

> **【面试口述】**在 `-Xmx512m` 的容器堆里，如果直接调 `getBytes()` 整包读取 128 MB 文件，在 G1 收集器下只要单对象超过半个 Region 就会被判定为 `Humongous` 巨型对象，绕过年轻代直接在老年代申请连续 Region，8 路并发上传瞬间就会切碎并撑满老年代触发 Full GC 甚至 OOM。所以我做了两层流式改造：接入侧前端按 8 MB 分片直传 MinIO 合并，Java 后端用 `DigestInputStream` 套一个固定 `8 KB` 的字节数组循环流式读取，首块验文件头魔数、后续算 SHA-256，堆占用始终是常数级。解析侧 Python Worker 按 15 页微批流式加载和释放张量，压测 8 路并发上传全程没有观测到巨型对象引发的 Full GC。

* **追问：如果线上监控看到 JVM 堆内存一直稳在 `300MB` 左右，但 Pod 还是隔两天就被 K8s `OOMKilled`（退出码 `137`），你会怎么排查？**

  > **答**：退出码 `137` 说明进程总物理常驻内存 `RSS` 撞上了容器 `cgroup` 内存上限被 Linux 内核强杀了，既然堆内稳在 `300MB`，问题一定出在堆外内存。我会分三步查：第一步先给容器留约 `20%～25%` 堆外余量（比如 `1G` 容器不要设 `-Xmx1g`），开启 `-XX:NativeMemoryTracking=detail` 用 `jcmd <pid> VM.native_memory detail.diff` 对比增长在哪一块，是线程栈太多、Metaspace 还是 Direct Memory。第二步重点查 Netty 或 NIO 的 `DirectByteBuffer` 有没有泄漏（可开 Netty `-Dio.netty.leakDetection.level=PARANOID` 抓未 `release` 的引用栈）。第三步如果是 `GZIPInputStream`、`Inflater` 或图像处理库底层 `malloc` 出来的 JNI C 堆没释放，检查所有流是否严格包进了 `try-with-resources` 调到 `close()`，必要时换 `jemalloc` 采堆外分配火焰图定位。

### 1.4 `Spring / Spring Boot` 自动装配、三级缓存与事务失效陷阱

#### 1. 核心定位与常考主线

两段核心项目分别采用 `Spring Boot` 与 `Spring Boot 3.2`。面试必问：Boot 3 自动装配改了什么？检索策略与五段流水线怎么利用 Spring 扩展点解耦？三级缓存为什么少一级都不行？为什么制造业草稿拆三阶段要用编程式 `TransactionTemplate` 而不用 `@Transactional`？

#### 2. 底层机制与高频考点

* **Spring Boot 3 自动装配演进**：

  * `@SpringBootApplication` 组合了 `@SpringBootConfiguration`、`@ComponentScan` 与核心 `@EnableAutoConfiguration`。

  * `AutoConfigurationImportSelector` 在 **Spring Boot 2.7 之前**扫描 `META-INF/spring.factories`；**Spring Boot 3.x 彻底移除旧键支持**，统一改为读取 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 按行加载候选配置类，再经 `@ConditionalOnClass`（类路径有对应客户端 Jar 才加载）、`@ConditionalOnProperty`、`@ConditionalOnMissingBean`（用户自定义了同名/同类型 Bean 则默认配置自动让位）按需注册。

* **Bean 生命周期核心扩展点**：实例化（反射调构造器）→ 属性填充（依赖注入）→ `Aware` 接口回调 → `BeanPostProcessor.postProcessBeforeInitialization` → `@PostConstruct` / `InitializingBean` → **`BeanPostProcessor.postProcessAfterInitialization`（AOP 动态代理 `AbstractAutoProxyCreator` 在此步生成 JDK 接口代理或 CGLIB 子类代理，Spring Boot 默认统一走 CGLIB）**。（注：`BeanFactoryPostProcessor` 在更早的 BeanDefinition 加载完、实例化开始前介入修改元数据）。

* **Spring 三级缓存解决 Setter/字段循环依赖与双反证**：

  * **三级结构**：一级 `singletonObjects`（完整成品单例）、二级 `earlySingletonObjects`（提前曝光的半成品原始对象或早期代理对象）、三级 `singletonFactories`（存 `ObjectFactory<?>` 延迟工厂钩子 `() -> getEarlyBeanReference(...)`）。

  * **反证一：为什么不能去掉三级缓存只留一、二级？** 正常无循环依赖的 AOP Bean 规范是在初始化**之后**才通过 `BeanPostProcessor` 创建代理。若没有三级工厂延迟钩子，要么所有 Bean 不管有没有循环依赖都在刚实例化完就提前造代理（违背 Spring 生命周期设计规范），要么发生循环依赖时 B 注入的是 A 的原始裸对象、而 A 初始化完进一级缓存变成了代理对象，导致 B 持有的 A 没有事务/切面增强且与容器最终单例对象引用分裂（Spring 检测到引用不一致会直接抛 `BeanCurrentlyInCreationException`）。

  * **反证二：为什么不能去掉二级缓存只留一、三级？** 当出现多路循环依赖 **`A -> B -> A` 且 `A -> C -> A`** 且 A 需要 AOP 代理时，若没有二级缓存保存第一次调三级工厂生成的同一个早期代理对象，B 注入 A 时调一次 `ObjectFactory.getObject()` 造出代理 `Proxy_A1`，C 注入 A 时又调一次造出另一个代理 `Proxy_A2`，直接破坏 Singleton 单例唯一性语义。

  * **边界**：构造器注入循环依赖（A 构造器要 B，B 构造器要 A）连第一步实例化空壳都完不成，无法放入三级缓存，必须在其中一个构造参数加 `@Lazy` 注入延迟代理破环。

* **`@Transactional` 高频失效场景与连接池死锁**：

  1. **同类内部自调用（最易踩）**：类内普通方法 `entry()` 直接调 `this.saveWithTx()`，绕过了外层 Spring CGLIB 代理对象，事务拦截器 `TransactionInterceptor` 根本没执行。

  2. **方法非 `public`**：标准代理事务要求目标方法为 `public`。

  3. **异常被内部 `try-catch` 吞掉**，或**抛出受检异常（Checked Exception）却未显式配置 `@Transactional(rollbackFor = Exception.class)`**（Spring 默认仅对 `RuntimeException` 和 `Error` 回滚）。

  4. **外层 `@Transactional` 内嵌 `PROPAGATION_REQUIRES_NEW` 的双连接死锁陷阱**：外层事务挂起时**并不会归还它已经持有的那条 HikariCP 数据库连接**，内层 `REQUIRES_NEW` 必须向同一个连接池再申请第二条新连接。若连接池 `max=20`，突发 20 个并发请求同时进入外层事务把 20 条连接全拿光，随后全部走到内层申请第 2 条连接，20 个线程互相死等归还连接直至 `connectionTimeout` 集体雪崩。

* **高频补充：事务传播机制、JDK/CGLIB 代理选择与 Spring MVC 请求链路**：

  1. **常用传播行为对比**：`REQUIRED`（默认，有则加入、无则新建，内外共生死）；`REQUIRES_NEW`（挂起外层另起独立事务，内层回滚不影响外层，但会同时占用两条数据库连接）；`NESTED`（基于数据库 `Savepoint` 保存点实现子回滚，复用同一条物理连接，外层回滚会连带回滚内层）。

  2. **JDK 动态代理 vs CGLIB**：JDK 代理基于接口反射生成实现类，要求目标类必须实现接口；CGLIB 基于字节码生成子类并重写方法，因此无法拦截 `final` 类、`final` 方法或 `private` 方法（Spring Boot 2.x/3.x 默认 `proxyTargetClass=true` 统一走 CGLIB）。

  3. **Spring MVC 标准请求链路**：请求进 `DispatcherServlet` → `HandlerMapping` 匹配目标路由与 `HandlerInterceptor` 拦截器链 → `HandlerAdapter` 调用参数解析器与 `@Valid` 校验 → 执行 Controller → `HttpMessageConverter`（Jackson）序列化写回响应；异常统一由 `@RestControllerAdvice` 收口返回标准错误码。

#### 3. 项目落地与系统设计权衡

* **设计模式落地**：NoteWeave 的 QA/Note/Wiki 检索模式与五段产物流水线（模板方法定「取材→规划→写作→校验→渲染」骨架，策略注册表通过构造函数注入 `List<ArtifactStrategy>` 转为不可变 `EnumMap` 并启动自检）完美实现开闭原则。

* **制造业草稿三阶段拆解为什么用 `TransactionTemplate`**：领单（`~10ms`）与写回（`~15ms`）中间夹着约 `7.2s～8.8s` 的大模型推理与规则校验。用编程式 `TransactionTemplate` 显式包住一、三两个毫秒级代码块，阶段二完全处于事务作用域之外，连接在阶段一结束瞬间立即归还给 HikariCP 连接池，在单机 3 线程跑 40 批（每批 5 单、跑完再投下一批，共 200 份，单份中位数 `7.2s`、复杂规程 `P90 8.8s`）的受控压测下，端到端 `P95`（第 190 名）由串行长事务排队叠加长尾的 `40.4s` 压降至 `15.2s`，单份草稿累计占用数据库连接仅约 **`25ms`**（稳态平均占用连接草稿约 `0.01` 条、叠加诊断约 `0.02` 条），每机最多 5 个旁路线程即使同刻写回也稳保通知主链路至少 `15` 条连接可用。

#### 4. 面试口述与连环追问

> **【面试口述】**在制造业维修草稿和通知领单里，我全部采用编程式 `TransactionTemplate` 而不是声明式 `@Transactional` 注解。一是因为草稿流程要把『10ms 领单、7 秒多模型推理、15ms 校验写回』放在一段高内聚编排代码里精确切开，如果用 `@Transactional` 拆同类私有或内部方法自调用会绕过 CGLIB 代理导致事务失效。二是严禁外层套 `@Transactional`、内层套 `REQUIRES_NEW`，因为外层挂起期间并不会释放借走的 HikariCP 连接，不仅白占连接 7 秒多，一旦并发请求先把池子外层连接占满，所有线程进内层申请第二条连接就会发生连接池饥饿死锁。用 `TransactionTemplate` 显式设 `READ COMMITTED` 和 2 秒超时，阶段一提交瞬间连接就归还了，单张草稿总共只占连接约 25 毫秒。

* **追问：你在 NoteWeave 里用了策略模式配模板方法做 QA/Note/Wiki 和五段产物流水线，在 Spring 里具体是怎么注入和防漏配的？**

  > **答**：我先定义一个统一的策略接口（带一个返回枚举类型的 `supportedType()` 方法），再写一个抽象模板基类用 `final` 方法把『取材、规划、写作、校验、渲染』五段主骨架固定下来，只把差异化的渲染和校验钩子留给子类实现。在编排器里，利用 Spring 构造器自动把容器里所有实现类收集成 `List<ArtifactStrategy>` 注入进来，在构造函数或 `@PostConstruct` 里转存进不可变的 `EnumMap`，并当场遍历枚举全集做启动期完整性自检——万一有人新增了产物枚举却忘了写对应策略 Bean，服务启动阶段就直接快速报错拦截，不会等到线上用户点生成才抛空指针。

### 1.5 异步服务事件循环防阻塞与混合并发隔离（`GIL` · `asyncio` · 进程池）

#### 1. 核心定位与常考主线

NoteWeave 采用 **Spring Boot（有状态编排与并发锁）+ Python（无状态解析、模型调用与多模态 MCP）** 双栈协作。高频深问点：Python 有 `GIL`，你们怎么扛并发？`asyncio` 协程里不小心调了一个同步函数会发生什么？

#### 2. 底层机制与项目落地

* **`GIL`（Global Interpreter Lock）本质**：CPython 内存管理采用非线程安全的引用计数（`ob_refcnt`），为避免每个对象加细粒度锁拖慢单线程性能，在解释器层加全局互斥锁，保证**单进程同一时刻只有一个操作系统线程能执行 Python 字节码**（默认每 `5ms` 请求让锁）。

  * **什么时候释锁**：遇到网络 Socket 读写、磁盘文件 IO，以及 `NumPy / PyTorch / OpenCV / faster-whisper` 底层 C/C++ 算子计算时，会主动释放 `GIL`；但纯 Python CPU 循环（如复杂正则文本切分、纯 Python PDF 解析）多线程抢锁切换反而比单线程更慢。

* **`asyncio` 事件循环冻结灾难与四层混合并发架构**：

  * `asyncio` 基于底层操作系统 `epoll/kqueue` 在**单线程内**通过 `await` 协作式切换成百上千个协程。一旦某个 `async def` 协程内部误调了同步阻塞调用（例如 `requests.get()`、`time.sleep()`、同步数据库驱动或耗时 500ms 的同步分词/PDF 光栅化），当前线程被卡住无法回到事件循环，**同进程内所有其他正在推送的流式请求和心跳协程全部瞬间冻结断连**。

  * **NoteWeave 生产级混合并发解法**：

    1. **多进程吃满多核**：启动 `Uvicorn --workers N` 多进程，每个 Worker 拥有独立 `GIL` 与独立事件循环。

    2. **纯异步网络池复用**：模型与公网抓取统一用进程级单例 `httpx.AsyncClient` 连接池（限制最大连接数与单域名连接数，连 `3s`/读 `20s`，防每次新建连接握手及短连接堆积大量 `TIME_WAIT` 耗尽临时端口），并用 `asyncio.Semaphore` 独立控制模型并发与搜索并发，多路并发用 `asyncio.gather(..., return_exceptions=True)` 防单路异常炸毁整组。

    3. **轻度同步库卸载**：第三方无异步版本的轻量 SDK 用 `await asyncio.to_thread(...)` 卸载到后台 IO 线程池。

    4. **重 CPU 算力进程池隔离**：15 页微批 PDF 光栅化 OCR 与视频抽帧 64 位 `pHash` 计算统一提交 `ProcessPoolExecutor` 独立子进程池执行，彻底与 `asyncio` 事件循环物理隔离。

#### 3. 面试口述与连环追问

> **【面试口述】**CPython 因为引用计数非线程安全引入了 `GIL`，单进程同一时刻只能有一个线程跑字节码，而 `asyncio` 是单线程事件循环靠 `await` 协作切换协程，一旦异步函数里混进 `requests` 同步调用或者重度 PDF 解析，整条事件循环就会被冻结，拖断同进程所有流式连接。所以在 NoteWeave 的 Python Worker 里，我用了四层混合架构：外层用多进程 `Uvicorn` 绕开单进程 `GIL`。网络层全局复用同一个 `httpx.AsyncClient` 连接池配 `Semaphore` 控制模型与搜索并发，避免频繁建连产生大量 `TIME_WAIT`。必须调的同步小库走 `asyncio.to_thread`。像 15 页微批扫描 PDF 渲染和关键帧 `pHash` 这类重 CPU 活，专门丢进 `ProcessPoolExecutor` 独立进程池，保证主事件循环不被重计算卡住。

* **追问：在 Python `asyncio` 里用 `asyncio.gather` 并发跑多路搜索或子任务时，如果默认不传 `return_exceptions=True`，其中一路超时报错会发生什么？**

  > **答**：默认 `return_exceptions=False` 时，只要有一路子协程抛出异常，`gather` 会立刻向外把异常抛给调用方，但**其余还在正常运行的兄弟协程并不会被自动取消**，它们会变成无人等待的后台孤儿任务继续占着连接池或信号量，甚至后续抛异常也没人消费。所以在 NoteWeave 里，对于允许部分降级的多路检索，我显式设 `return_exceptions=True` 把异常当普通返回值按路兜底处理。对于需要同生共死的任务组，在 Python 3.11+ 上用 `asyncio.TaskGroup` 结构化并发，任一分支失败会自动取消其余在途任务并等清理完 `finally` 释放信号量后再退出。

### 1.6 `Linux 网络 IO`、`epoll`（`LT` vs `ET`）、传输层协议与 `SSE` 流式背压

#### 1. 核心定位与常考主线

简历在 NoteWeave 技术栈与职责 4 突出写了 **`SSE`** 与流式回答解耦；本地上传的《Linux 网络 IO 学习与面试讲义》更是后端面试必考底座：一次读取分哪两步？五种 IO 模型怎么分？`select / poll / epoll` 本质区别是什么？为什么 `ET` 必须配非阻塞读到 `EAGAIN`？慢客户端怎么把非阻塞服务器内存撑爆？为什么流式回答选 `SSE` 而不是 `WebSocket`？

#### 2. 底层机制与高频考点

* **一次网络读取的两阶段与 TCP 字节流本质**：

  * `fd`（文件描述符）只是进程打开文件表里的整数索引（连接关闭后会复用，故异步任务写回绝不能只拿旧 `fd` 整数判身份，须绑连接对象与代际标识，见 [close(2)](https://man7.org/linux/man-pages/man2/close.2.html)）。

  * 普通 Socket `read/recv` 分两逻辑阶段：**① 等待内核协议栈接收缓冲区有数据可读**；**② 将数据从内核缓冲交付（复制）到用户态缓冲区并返回字节数**（正数为本次读到字节、`0` 为对端关闭写方向 EOF、`-1` 且 `errno == EAGAIN / EWOULDBLOCK` 为非阻塞当前无数据可读，见 [recv(2)](https://man7.org/linux/man-pages/man2/recv.2.html)）。TCP 是无消息边界的字节流，应用必须维护接收缓冲与解析状态机处理粘包/半包。

* **阻塞/非阻塞 vs 同步/异步 与 五种 IO 模型**：

  * **阻塞 vs 非阻塞**：关注当前暂时无法推进时，调用是挂起睡眠等待还是立即返回 `EAGAIN`。

  * **同步 vs 异步**：关注**收到通知后，是否还需要应用自己发起真正的读写系统调用**。前四种（阻塞 IO、非阻塞轮询、IO 多路复用、信号驱动 `SIGIO`）收到就绪提示后仍需应用调 `recv` 取数据，均属**同步 IO**；第五种**异步 IO**（如 POSIX `aio_read` 或 `io_uring` 提交读写 `SQE` 收取完成 `CQE`，见 [io_uring(7)](https://kernel.googlesource.com/pub/scm/linux/kernel/git/axboe/liburing/+/refs/heads/master/man/io_uring.7)）先提交缓冲区与操作，收到通知时数据已读完直接消费结果。

* **`select`、`poll` 与 `epoll` 三代多路复用深度对比**：

| 对比维度 | `select`（[select(2)](https://man7.org/linux/man-pages/man2/select.2.html)） | `poll`（[poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html)） | `epoll`（[epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html)） | 
| ----- | ----- | ----- | ----- | 
| **集合表示与容量边界** | `fd_set` 定长位图，受常见 libc `FD_SETSIZE=1024` 限制（**限制的是最大 `fd` 编号而非连接个数**，单调大 `ulimit` 不扩位图），且返回会原地改写输入位图 | `struct pollfd[]` 动态数组，`events`（兴趣）与 `revents`（结果）分离，突破 1024 位图编号限制 | `epoll_create1` 创建内核实例，`epoll_ctl(ADD/MOD/DEL)` 持久维护兴趣集合，`epoll_wait` 只取就绪批次（`maxevents` 仅限单批返回容量，不限总监听数） | 
| **每轮等待与扫描成本** | 每轮重复传入完整位图，内核线性扫描 `O(N)`，用户态再扫位图找就绪者 | 每轮仍需传递并线性检查整个 `pollfd` 数组 `O(N)`，海量空闲长连接下无效工作大 | **登记与等待解耦**：内核用**红黑树**管理监听项增删查 `O(log N)`，挂接网卡/协议栈等待队列回调，活跃连接就绪时推入**就绪候选链表**，`epoll_wait` 围绕活跃对象复核交付 | 
| **常见认知边界** | 无事件阻塞等待时线程是睡眠的，并非死循环占满 CPU（零超时外层死循环才会空转） | 连接少且几乎全活跃时，简单数组常数开销低，未必比 `epoll` 慢 | **绝不能盲背「epoll 靠共享内存实现零拷贝」或「所有操作绝对 O(1)」**：`epoll_wait` 仍将事件元数据拷入用户数组，Socket 业务负载仍需调 `recv` 拷贝（`sendfile` 才是文件传输零拷贝） | 

* **`LT`（水平触发）vs `ET`（边缘触发）与公平续跑**：

  * **`LT`（默认，Redis `ae_epoll.c` 即采用 LT）**：只要内核缓冲区还有未读数据或发送缓冲有空间，后续 `epoll_wait` 会持续重复报告。注意：**LT 下空闲连接通常一直可写，严禁无数据可发时长期注册 `EPOLLOUT`，否则每轮都会触发无用可写通知导致 CPU 100% 空转**（应先直接尝试 `send`，遇 `EAGAIN` 再挂 `EPOLLOUT`，发空后立即移掉写兴趣）。

  * **`ET`（`EPOLLET`）为什么必须配非阻塞循环读到 `EAGAIN`？**（两步因果链）：① `ET` 不能依赖「缓冲区还剩半截数据」自动产生重复提醒，若一次通知只调一次 `recv` 留下残余字节，对端又在等服务端回包，双方就会永久死等卡住；② 因此必须循环读取排空（drain），但若用阻塞 Socket，把最后一点数据读空后的下一次 `recv` 会直接把整条事件循环线程挂死在这一个连接上，拖垮同线程上成千上万个其他就绪连接。所以必须设 `O_NONBLOCK` 读到返回 `EAGAIN` 为止。

  * **大流量饥饿防护**：若某连接高速发包永远读不到 `EAGAIN`，不能无限独占事件循环——应设单轮字节预算（如 `64KB`），预算耗尽仍未见 `EAGAIN` 时将该连接放入**用户态待处理就绪队列**主动轮转续跑（队列非空时 `epoll_wait` 不能无限阻塞睡眠）。

* **多线程惊群与连接所有权**：多个 `epoll` 实例共享同一监听 Socket 可用 `EPOLLEXCLUSIVE`（仅 `ADD` 时指定，唤醒一个或多个）或 `SO_REUSEPORT`（内核级多独立监听队列分流）；多线程共享同一 `epoll` 时用 `EPOLLONESHOT` 交付一次后暂停报告，处理完再 `MOD` 重新激活（rearm），但业务状态最好固定归属同一 `EventLoop`（如 Netty 模型）串行维护。

* **`SSE` vs `WebSocket` 与慢客户端背压（Backpressure）**：

  * **协议选型**：AI 流式回答本质是「客户端一次提问 → 服务端持续单向推流」。`WebSocket` 是全双工独立协议，需 `101 Switching Protocols` 升级、自建应用层帧格式、心跳与网关粘性路由；`SSE`（`Content-Type: text/event-stream`）基于标准 HTTP 长连接，天然穿透企业防火墙（HTTP/2 多路复用下消除浏览器同域名 6 连接限制），且浏览器原生 `EventSource` 内置 `id:` 字段记录与断网自动携带 `Last-Event-ID` 请求头重连机制。

  * **为什么 NoteWeave 把提问拆成 `POST + GET` 两步**：原生 `EventSource` 标准只支持发 `GET` 请求（无法带长 JSON 请求体且 URL 易超长泄露敏感上下文），故前端先 `POST` 创建幂等 `Turn` 拿到 `turnId`，再 `GET` 订阅事件流；Nginx 侧必配 `X-Accel-Buffering: no` 关闭代理缓冲防攒块，服务端每 `15s` 推 `: heartbeat\n\n` 注释帧防网关空闲超时掐断。

  * **慢客户端吃光内存与背压**：非阻塞发送只保证线程不卡在 `send()`，但若上游模型每秒吐出数据远快于弱网客户端接收速度，未发数据若无限堆积在应用内存队列里，几千路慢连接就能把堆或堆外内存撑爆（如 Netty `WriteBufferWaterMark` 高低水位变不可写时若继续硬写照样 OOM）。NoteWeave 用 **有界定长裁剪 `Redis Stream`（`MAXLEN ~ 1000`）+ MySQL `5s` 滚动前缀检查点**解耦生成与推送连接，生成端只管写有界 Stream，单路慢连接读落后超界直接切换检查点覆盖同步，从架构上封死了单连接内存无界膨胀。

* **高频补充：TCP 三次握手、四次挥手与半/全连接队列治理**：

  1. **三次握手与四次挥手本质**：三次握手用双向 `SYN + ACK` 确认双方收发能力正常并同步初始序列号（ISN），防止历史失效 `SYN` 滞留网络导致服务端白建空连接；四次挥手因 TCP 全双工，主动关闭方发 `FIN` 后仅关闭写方向，被动方可能还有未发完数据，故 `ACK` 与被动方的 `FIN` 需拆成两步。

  2. **`TIME_WAIT` 与 `CLOSE_WAIT` 线上排查判据**：主动关闭方在最后一次 `ACK` 后等待 `2MSL`（Linux 常为 60s）确保对端收到 `ACK` 且旧连接迷路报文在网络消散，大量 `TIME_WAIT` 常见于短连接高频调下游（解法是开启 HTTP/RPC 长连接池复用）；大量 `CLOSE_WAIT` 几乎 100% 是**本机业务代码收到对端 `FIN` 后漏调 `close()`**（如流或 HttpClient 响应未进 `try-with-resources`）。

  3. **半连接队列（SYN Queue）与全连接队列（Accept Queue）**：收到 `SYN` 进半连接队列，完成第三次握手移入全连接队列等待应用 `accept()`；全连接队列上限取 `min(listen backlog, net.core.somaxconn)`，通过 `ss -lnt` 观察监听端口 `Recv-Q` 逼近 `Send-Q` 即说明应用 `accept` 不过来发生队列溢出丢包。

* **传输层与安全层必考延伸（`TLS 1.3` · `TCP 流控/拥塞控制 BBR` · `HTTP/3 QUIC`）**：

  * **`TLS 1.3` 握手提速与 `0-RTT` 边界**（参考 [RFC 8446](https://datatracker.ietf.org/doc/html/rfc8446)）：废弃不具备前向保密的静态 RSA 密钥交换，客户端在首包 `ClientHello` 的 `key_share` 扩展中直接携带 `ECDHE` 椭圆曲线临时公钥，将完整握手从 `TLS 1.2` 的 `2-RTT` 压缩至 **`1-RTT`** 并强制实现**前向保密（PFS，日后私钥泄露也无法解密历史抓包流量）**；会话恢复虽支持 `0-RTT` 首包带业务数据，但 `0-RTT Early Data` 缺乏防网络重放攻击保证，**严禁用于扣款、创单等非幂等写接口**。

  * **TCP 流量控制 vs 拥塞控制**：**流量控制**点对点保护慢接收端，发送方受对端通告接收窗口 `rwnd` 约束（`rwnd=0` 时定时发 1 字节零窗口探测帧 `ZWP` 防恢复通知丢失死锁）；**拥塞控制**保护公网链路，发送窗口取 `min(rwnd, cwnd)`，传统 CUBIC 靠「慢启动 → 拥塞避免 → 3 次重复 ACK 快重传与快恢复」以丢包判拥塞，弱网随机丢包下吞吐骤降，而现代 Linux **`BBR`** 主动测量瓶颈最大带宽 `BtlBw` 与最小往返时延 `RTprop` 按带宽时延积发包，在跨网高丢包流式推流下显著降低尾延迟。

  * **`HTTP/2` TCP 队头阻塞与 `HTTP/3 QUIC`**：`HTTP/2` 虽在单 TCP 连接上多路复用消除了应用层队头阻塞，但底层一旦丢 1 个 TCP 包，内核协议栈必须卡住所有并发 Stream 等待重传（传输层队头阻塞）；`HTTP/3` 基于 UDP 实现用户态 **`QUIC`**（参考 [RFC 9000](https://datatracker.ietf.org/doc/html/rfc9000)），每条 Stream 独立编号重传互不连坐，合并传输与加密握手至 `1-RTT`，并凭独立 `Connection ID` 实现手机从 Wi-Fi 切 5G 换 IP 时流式回答不断连。

#### 3. 面试口述与连环追问

> **【面试口述】**AI 流式问答是典型的单向推流，我选 `SSE` 而不是 `WebSocket`，是因为 `SSE` 直接复用标准 HTTP 协议免去协议升级成本，而且浏览器 `EventSource` 原生支持断线自动带 `Last-Event-ID` 重连。由于 `EventSource` 只支持 `GET`，我把接口拆成先 `POST` 创建带唯一键的幂等 `Turn`，再 `GET` 订阅流，配 Nginx 关闭代理缓冲和 15 秒注释心跳。往底层网络 IO 看，高并发长连接靠 `epoll` 加非阻塞 Socket 支撑：内核用红黑树管监听登记增删查、就绪链表交付活跃事件。如果开 `ET` 边缘触发，必须配非阻塞循环读到 `EAGAIN`，否则残留数据不二次通知会卡死，同时给大流量连接设单轮读取预算放用户态队列续跑防饥饿。另外非阻塞解决不了慢客户端积压，所以我没有把流绑在单机内存队列里，而是用 `MAXLEN ~ 1000` 定长裁剪的 `Redis Stream` 加 `5 秒` 数据库检查点做有界缓冲解耦。

* **追问 1：很多同学背「`epoll` 快是因为用了 `mmap` 共享内存实现零拷贝」，这种说法对吗？**

  > **答**：这是典型的流传误区，在 Linux 内核源码里并不成立。`epoll_wait` 在内核态仍然是通过 `__put_user` 把就绪事件从内核链表逐项拷贝到用户态传入的 `epoll_event` 数组里的，并没有用 `mmap` 映射事件区。而且就绪通知完之后，真正读取 Socket 里的业务字节流依然要调 `recv / read` 把数据从内核接收缓冲区拷到用户态缓冲区。`epoll` 真正省掉的是 `select / poll` 每轮重复把成千上万个监听 `fd` 从用户态拷进内核态、以及内核线性扫描全部空闲连接的无谓开销。真正意义上的文件网络发送零拷贝是 Kafka 用的 `sendfile`。

* **追问 2：HTTPS 下推 `SSE` 流时，`TLS 1.3` 是怎么把握手降到 `1-RTT` 的？`0-RTT` 能用来发你们的提问 `POST` 请求吗？**

  > **答**：`TLS 1.2` 需要先花 `1-RTT` 协商密码套件，第 2 个 RTT 才交换密钥参数。`TLS 1.3` 精简了算法族，让客户端在第一个 `ClientHello` 包里直接猜好常用椭圆曲线并带上自己的 `ECDHE` 临时公钥，服务端收到直接算出共享会话密钥连同证书一起回包，`1-RTT` 就完成建连并自带前向保密。至于会话恢复的 `0-RTT`，虽然首包就能夹带业务请求，但攻击者抓包重放这份 `0-RTT` 数据时服务端无法仅凭协议层区分是不是重放攻击。如果我们的 `POST` 提问接口没带严格的一次性业务幂等键就放进 `0-RTT`，重放会导致后台重复扣减配额跑两次大模型生成，所以工程上一般只对幂等只读请求开 `0-RTT`，创建会话走标准 `1-RTT` 加服务端唯一键兜底。

### 1.7 线上接口超时与响应慢的分层排查（含 Agent / RAG P99）

#### 1. 核心定位与常考主线

回答「接口为什么慢」时不能只回答看日志，而要把端到端延迟按可观测边界拆开：入口网关、业务线程池与连接池、JVM STW、下游 RPC / Redis / MySQL、外部模型与检索各段，先确定主要耗时落在哪一层，再进入单机取证。Agent 链路还要多拆首字延迟（TTFT）、单步生成间隔（TPOT）、工具调用和重排耗时。

#### 2. 底层机制与高频考点

* **普通后端接口的分层定位链路**：

  1. **先对齐时间拐点与变更**：把 P99 抬升时刻与发布、配置变更、流量突增、依赖告警对齐，优先排除新代码、重试放大和流量结构变化，而不是平均 RT 掩盖长尾。

  2. **用 traceId 拆 Span**：按网关 → Controller → Service → RPC → Redis / DB 各段的 P95/P99 排序，找到占总耗时 60% 以上的第一段，区分「本机 CPU 忙」「线程等待锁」「连接池排队」「下游真正慢」四种根因。

  3. **单机线程取证**：`top -Hp <pid>` 找高 CPU 线程，`printf '%x\n' <tid>` 转十六进制后用 `jstack` 对齐；RUNNABLE 多为死循环/正则回溯，BLOCKED 多为锁竞争，WAITING 在 pool/连接池多为池耗尽或下游无响应，GC 线程高则是 STW 或分配过快。

  4. **排除重试放大**：入口超时 3s、下游重试 3 次 × 2s 会把用户感知延迟放大到 6s 以上；先收紧重试与剩余时间预算，再判断真实下游耗时。

* **Agent / RAG 链路的 P99 归因**：

  * **TTFT 变长**：多为模型供应商限流、Prompt 变长导致 Prefill 排队、检索扩窗或重排候选过多、同步等待非流式上游；优先检查 RPM/TPM 配额、prompt_tokens、检索 top_k、Rerank 候选数与模型路由。

  * **TPOT 变慢**：多为 Decode 显存带宽或 KV Cache 饱和，关注 `gpu_cache_usage_perc`、Continuous Batching 等待队列、输出 token 数和是否误关流式。

  * **检索段 P99 抖动**：分别记录解析、向量召回、BM25、RRF、Cross-Encoder、主库复核的耗时；不能把所有 bad case 都归因于模型幻觉，召回漏、重排偏、过滤误裁和版本过期要分开看。

  * **止血顺序**：限制 max_tokens 与候选数 → 热问题结果缓存 → 降级小模型或关闭非必要工具 → 给慢工具设硬超时与兜底 → 必要时转人工，不能为追平均延迟牺牲正确性。

#### 3. 项目落地与系统设计权衡

NoteWeave 将检索、重排、主库复核和模型首包分段打点后，可以明确区分「RRF 阶段慢」与「模型生成慢」；制造业通知链路则把 RabbitMQ、运营商网关、MySQL 连接池分开计时，避免把运营商异步落账误当成本机慢 SQL。超时预算从入口向下一层递减，外部写请求配稳定请求号，读超时进入对账而不是直接重试。

#### 4. 面试口述与连环追问

> **【面试口述】**接口变慢时我先按网关、应用、GC、下游和连接池拆 Span，找到最大耗时贡献段，再用 top、jstack、连接池和慢查询指标验证。Agent 链路会额外拆 TTFT、TPOT、检索和工具调用：首字慢先看模型配额、Prefill 和 Rerank，生成慢看显存与 KV Cache，检索慢分段查召回和重排。止血先限输出与候选数、缓存热结果、降级模型和设工具超时，不能一上来就扩线程或重启。

* **追问：P99 从 200ms 涨到 2s，怎么区分是自身 Full GC 还是下游慢？**

  > **答**：先把 Full GC 日志时间戳与慢请求时间窗对齐，若高度重叠再看 jstat 的 FGC/FGCT 增速，基本可锁定 STW；不重叠则按 trace Span 拆到下游，把下游 mock 成固定 1ms 本地调用做对照。若 mock 后恢复，就是下游问题；若仍慢，再查本机连接池、锁和线程栈。

## 二、关系型与多模向量数据库深度考点（MySQL 8 · PostgreSQL pgvector）

### 2.1 `MySQL` 存储架构、`B+ 树` 索引、聚簇回表与 `Buffer Pool` 冷热隔离

#### 1. 核心定位与常考主线

两段经历重度依赖 `MySQL 8`（制造业 8.0.36，NoteWeave 8.4）。面试常考：一条 SQL 怎么执行？为什么用 `B+ 树` 不用红黑树或哈希？聚簇索引和二级索引怎么配合？两千万行怎么算出来的？为什么制造业把 3 万条向量拆到独立 PostgreSQL 而不塞进 MySQL？

#### 2. 底层机制与高频考点（参考 [MySQL 8.4 Manual](https://dev.mysql.com/doc/refman/8.4/en/)）

* **架构分层与 `16KB` 数据页**：Server 层管连接、词法语法解析、基于成本的优化器（CBO）与执行器；InnoDB 引擎层按默认 `16KB` 页（Page）为单位与磁盘交互。与 MyISAM 相比，InnoDB **支持事务 ACID、支持 `MVCC` 多版本无锁快照读、支持行级锁与外键、数据按主键聚簇存储**（MyISAM 仅支持表锁、无事务崩溃恢复、`.MYD` 数据与 `.MYI` 索引文件物理分离，仅无 `WHERE` 条件的全表 `COUNT(*)` 可直接读元数据计数）。

* **为什么 InnoDB 选 `B+ 树`**：

  1. **对比平衡二叉树 / 红黑树**：二叉树每个节点最多 2 个分支，千万行树高达 20 多层，磁盘随机页读取太多；B+ 树是多路平衡查找树，非叶子节点**不存完整行数据，只存分界键值和子页指针**，单个 `16KB` 内部页扇出（Fan-out）可达上千，三层树即可承载千万级数据。

  2. **对比 B 树**：B 树内部节点也存行数据，不仅大幅挤占内部页容量降低扇出（导致树变高），而且范围查询需在层间反复中序回溯；B+ 树所有数据均在叶子层，且同层叶子页通过**双向链表**顺序相连，等值定位起点后顺链表扫描即可高效完成范围查询与按索引排序。

  3. **对比 Hash 索引**：哈希等值查找 `O(1)`，但无序，不支持范围查询（`>` / `<` / `BETWEEN`）、不支持 `ORDER BY` 消除排序、不支持最左前缀匹配。

* **聚簇索引、二级索引、回表与覆盖索引**：

  * **聚簇索引（Clustered Index）**：叶子页直接存完整行记录（优先选显式 `PRIMARY KEY` → 第一个全列 `NOT NULL` 的 `UNIQUE` 索引 → 隐藏 6 字节 `DB_ROW_ID`）。主键不宜用无序长 `UUID`，否则一会让所有二级索引叶子变胖降低扇出，二会随机插入引发频繁页分裂（Page Split）与空间碎片。

  * **二级索引与回表**：叶子页存「索引列值 + 主键 `id`」。若查询列包含索引外的字段（如 `title`），需拿主键再去聚簇索引查一次完整行即**回表**；若所需过滤列与返回列全在二级索引中（`EXPLAIN` `Extra: Using index`），即**覆盖索引**免回表（严谨补充边界：当二级索引页被并发新事务修改或记录带删除标记时，InnoDB 为判断 `MVCC` 可见性仍可能回聚簇记录检查 `DB_TRX_ID`）。

* **三层 B+ 树容量推导**：设内部页主键 `BIGINT(8B)` + 页号指针 `6B` = `14B`，扣除页头页目录开销后单页扇出 `F ≈ 1000 ~ 1170`；若单行宽约 `1KB`，叶子页存 `L ≈ 15 ~ 16` 行，则三层树容量 `N ≈ F² × L ≈ 1600万 ~ 2200万` 行（若窄表每页存 80 行则可达八千万行，故两千万只是特定行宽估算，绝非硬阈值）。

* **高频补充：一条 SQL 执行路径与 `Change Buffer` 写优化**：

  * **SQL 执行链路**：连接器鉴权与池化 → 分析器做词法语法解析生成 AST → 优化器按统计信息与代价模型（CBO）选索引和连接顺序 → 执行器调存储引擎接口逐行读写并回传结果集（MySQL 8.0 已彻底移除鸡肋的 Query Cache）。

  * **`Change Buffer`（写缓冲）**：更新**非唯一二级索引**且目标索引页不在 Buffer Pool 时，无需立刻随机读盘，InnoDB 先把变更记入内存 Change Buffer（同时写 Redo Log 保持久），等后续查询真正读到该页时再合并（Merge），将大量随机写合并为顺序批量写；但**唯一索引**因插入前必须立刻判重，无法利用 Change Buffer，这也是高并发写表非必要不建普通唯一索引的原因之一。

* **`Buffer Pool` `5:3` 改进型 LRU 链表（防扫描污染）**：InnoDB 将缓冲池链表按 **`5:3`** 拆为新生代热区（Young）与老生代冷区（Old）。新从磁盘读入的页先插在 **Old 区头部（midpoint）**，只有当该页在 Old 区驻留时间超过 `innodb_old_blocks_time`（默认 **`1000ms / 1s`**）后再次被访问，才会晋升到 Young 热区头部（参考 [InnoDB Buffer Pool](https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool.html)）。

#### 3. 项目落地：为什么制造业把 3 万条手册切片物理拆到独立 PostgreSQL？

虽然 InnoDB `1s` 冷区驻留能防住低频全表备份单次扫过，但制造业告警诊断旁路在高峰期会**每隔几秒反复高频扫描**几千条 `4KB` 向量切片，很快就会跨过 `1s` 门槛持续晋升到热区，把核心通知任务主表的热索引页挤出 `Buffer Pool` 拖慢通知领单。物理拆分到公司既有独立 `PostgreSQL 16` 实例后，不仅彻底保护了 MySQL 核心缓冲池，两边也只靠单调递增的「知识发布批次号」松耦合关联，零跨库分布式事务负担。

#### 4. 面试口述与连环追问

> **【面试口述】**InnoDB 默认按 `16KB` 页管理存储，用 B+ 树是因为非叶子节点只存键值和页指针，单页扇出上千，三层树就能装两千万左右行宽 1KB 的记录，而且叶子节点用双向链表串起来非常适合范围扫描和索引排序。另外 InnoDB 的 `Buffer Pool` 采用 `5:3` 新老生代 LRU 加 `1 秒` 老区驻留阈值来防偶发全表扫描污染，但在我实习的制造业平台里，AI 诊断旁路需要高频扫描几万条 `4KB` 的向量数据，超过 1 秒后照样会晋升热区把通知主表的热索引挤出去，这也是我们坚持把工业知识库物理拆到独立 PostgreSQL 只读实例、并且给 MySQL 历史通知单每晚归档 7 天前冷数据控在百万行以内的核心原因。

* **追问：`EXPLAIN` 里看到 `Extra: Using index` 命中了覆盖索引，是不是代表 InnoDB 执行时绝对不会去读聚簇索引页了？**

  > **答**：绝大多数干净数据页确实不用回表，但有一个很关键的 `MVCC` 边界例外：InnoDB 的二级索引记录里并不像聚簇索引那样每行都存 `DB_TRX_ID` 事务号，而是只在整个二级索引页头记一个修改过该页的最大事务号 `PAGE_MAX_TRX_ID`。当读请求扫到某个二级索引页时，如果发现该页的 `PAGE_MAX_TRX_ID` 大于等于当前 `ReadView` 的低水位（说明最近有活跃或新事务刚改过这个索引页），或者该二级索引项被打上了删除标记 `delete-marked`，二级索引自己判断不了当前快照到底能不能看见这行，此时哪怕查询列全在二级索引里，InnoDB 依然必须拿着主键回聚簇索引查版本链确认可见性。

### 2.2 `联合索引`列顺序证明、`EXPLAIN` 慢查询优化与 `Online DDL`（`INSTANT` 64 版本陷阱）

#### 1. 核心定位与常考主线

简历在制造业职责 1 明确点名：**「基于『状态 + 优先级 + 到期时间』联合索引」**。高频深问点：这三列的顺序能不能调换？如果写成 `(status, next_run_at, priority)` 会发生什么？深分页怎么优？百万行大表不停机加列有什么坑？

#### 2. 底层机制与项目深度结合

* **制造业 `(status, priority, next_run_at)` 三列联合索引顺序严格证明**：

  * **目标领单 SQL**：在 `status = 'PENDING'` 且 `next_run_at <= NOW()` 的到期任务中，按 `ORDER BY priority ASC, next_run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED` 取出优先级最高、到期最早的一条。

  * **第 1 列放等值 `status`**：表里 99% 以上是已完结历史记录，`status = 'PENDING'` 等值条件先一步把扫描区间急剧收敛到极小的待发送子集。

  * **为什么第 2 列必须放 `priority` 而不能放范围列 `next_run_at`？** 联合索引按列从左到右逐级排序。若建成 `(status, next_run_at, priority)`，固定 `status='PENDING'` 后，记录是按 `next_run_at` 排的，不同到期时间下的 `priority` 是乱序散落的——优化器为了找 `priority` 最小的那条，必须把所有到期行全扫出来做一次内存/磁盘额外排序（`EXPLAIN` 的 `Extra` 出现 **`Using filesort`**）。而建成 **`(status, priority, next_run_at)`** 后，由于 `priority` 只有 `P0～P3` 四个离散档位，待发送子集内天然先紧贴排完所有 `P0`（且 `P0` 内部按 `next_run_at` 升序排列），再排 `P1`。扫描时从 `P0` 最小时间看起，配合索引条件下推（`ICP`，`Extra: Using index condition`）在引擎层直接核验 `next_run_at <= NOW()`，命中首条未锁记录即可直接停止（无 `Using filesort`）。

* **高频补充：`EXPLAIN` 执行计划四看判据**：

  1. **`type`（访问类型由优到劣）**：`const`（主键/唯一等值） > `eq_ref`（唯一键关联） > `ref`（非唯一等值） > `range`（索引范围） > `index`（全索引扫描） > `ALL`（全表扫描）；核心线上查询至少应达到 `range` 级别。

  2. **`key` 与 `key_len`**：验证实际命中的索引，并根据 `key_len`（`int=4B`、`bigint=8B`、`utf8mb4 varchar(n)=4n+2`、允许 `NULL` 再 `+1B`）反推联合索引到底用上了前几列。

  3. **`rows × filtered`**：预估扫描行数与过滤留存率，判断索引区分度是否过低或统计信息过期（必要时用 `ANALYZE TABLE` 刷新）。

  4. **`Extra` 红绿灯**：`Using index`（覆盖索引）与 `Using index condition`（索引下推）是绿灯；`Using filesort`（额外排序）与 `Using temporary`（临时表）是高频慢查询红灯信号。

* **深分页优化（复合游标翻页 vs 延迟关联）**：

  * `LIMIT 100000, 20` 慢在二级索引扫过 `100,020` 项并触发高达十万次无谓聚簇回表后全部丢弃。

  * **解法一（连续下拉：复合游标分页）**：记住上一页末行的 `(updated_at, id)`，下一页查 `updated_at < T OR (updated_at = T AND id < last_id) ORDER BY updated_at DESC, id DESC LIMIT 20`（必须带唯一主键 `id` 打破同时间戳平局防漏行）。

  * **解法二（随机跳页：延迟关联 Deferred Join）**：子查询只走二级覆盖索引扫出目标页的 `20` 个主键 `id`，外层再 `INNER JOIN` 原表仅回表 `20` 次拿宽字段。

* **索引失效五大高频原因**：① 左模糊 `LIKE '%词'`；② 索引列套函数或运算（如 `DATE(updated_at) = '2026-11-01'`，应改写为半开区间 `updated_at >= '2026-11-01 00:00:00' AND updated_at < '2026-11-02 00:00:00'` 以完整覆盖小数秒）；③ 隐式类型转换（如 `varchar` 列传数字不加引号，MySQL 将字符串列转浮点相当于对列套函数）或连表字符集/排序规则不一致（`utf8mb4_0900_ai_ci` vs `utf8mb4_general_ci`）；④ `OR` 连接了无索引列；⑤ 违背联合索引最左前缀或优化器评估回表比例过高主动走全表扫描。

* **MySQL 8 `Online DDL` 与 `MDL` 排他锁风险**：

  * **三类算法**：① **`ALGORITHM=INSTANT`**（MySQL 8.0.12+ 加普通列、8.0.29+ 支持任意位置加删列）：仅修改数据字典并在行记录头记 `1B` `row_version`，毫秒级完成——**核心盲区考点**：单表累计 `INSTANT` 加删列硬上限为 **`TOTAL_ROW_VERSIONS <= 64`**（查 `information_schema.innodb_tables`），一旦满 64 次且 DDL 未显式写死 `ALGORITHM=INSTANT`，MySQL 会静默退化为 `INPLACE/COPY` 重建百万行大表引发线上锁表事故，需在迫近上限前于低峰期跑 `OPTIMIZE TABLE` 清零计数；② **`ALGORITHM=INPLACE`**（加二级索引）：原地构建并回放期间 `row log` 增量；③ 改列类型等无法 Inplace 操作走 `gh-ost` 订阅 binlog 异步同步影子表再原子 `RENAME`。

  * **`MDL`（Metadata Lock）排队堵死全库**：即便 `INSTANT` 也需在首尾瞬间申请 **MDL 排他写锁（X）**。若此时表上恰好挂着一个未提交的慢查询或空闲长事务持有 MDL 共享读锁（S），DDL 的 MDL 写锁会排队等待，而 MDL 锁队列具有写锁优先级，**排在该 DDL 后面的所有普通 `SELECT / UPDATE` 全部被连坐阻塞**，瞬间打满连接池。故执行 DDL 前必查 `information_schema.innodb_trx` 清理长事务并设 `lock_wait_timeout = 3`。

#### 3. 面试口述与连环追问

> **【面试口述】**在制造业通知任务表上，我建的是 `(status, priority, next_run_at)` 三列联合索引。列顺序是严格按查询成本推出来的：第一列 `status` 是等值过滤，直接筛掉九成九的历史完结单。第二列必须放 `priority` 而不是范围条件 `next_run_at`，因为如果把范围列放中间，后面的 `priority` 就没法利用索引有序性，`EXPLAIN` 会出现 `Using filesort` 把所有到期单全扫出来重排。把只有 P0 到 P3 四个值的 `priority` 放第二列后，每个优先级内部天然按到期时间升序排列，配合 `ICP` 索引条件下推，从 P0 顺扫命中第一条到期未锁行就能立刻返回。另外百万行表后期维护加列时，我们显式指定 `ALGORITHM=INSTANT` 毫秒级改元数据，但专门加了巡检核查 `innodb_tables` 的 `TOTAL_ROW_VERSIONS` 不超过 `64` 次硬上限防静默退化重建表，并且在低峰期先查杀未提交长事务防止 `MDL` 排他锁排队把普通读写全堵死。

* **追问：很多人背八股说「像 `status` 这种只有三四个枚举值、区分度极低的字段不适合建索引」，为什么你的联合索引偏偏把 `status` 放在第一列？**

  > **答**：『区分度低不建索引』指的是数据分布均匀的单列索引，比如男女各占 50%，扫二级索引再回表一半数据确实不如全表顺序扫。但任务表的数据分布是**极度倾斜**的：百万行表里 `99.9%` 都是已经发完的 `ACCEPTED / CANCELLED` 历史终态单，真正处于 `PENDING` 待发送的活跃单任何时刻只有几十到几千条。这时候等值条件 `status = 'PENDING'` 的实际过滤性极强，放在联合索引第一列能一刀砍掉 `99.9%` 的无关数据，并让后面的 `priority` 和 `next_run_at` 在极小的待办区间内天然有序。

### 2.3 `事务 ACID`、`隔离级别`、`MVCC`（`ReadView`）与四类并发锁实战

#### 1. 核心定位与常考主线

两段核心项目对数据库并发控制都有具体落地：NoteWeave 用**统一研究单元锁定顺序**与**MySQL 批量复核权威状态**防死锁与脏召回；制造业平台用 **`SKIP LOCKED` 领取与租约回收**、**短事务领取 + 事务外模型调用 + 版本校验写回**隔绝长事务拖垮连接池。这部分重点说清 MVCC、锁粒度与隔离级别的工程取舍。

#### 2. 底层机制与高频考点

* **`MVCC`（Multi-Version Concurrency Control）三大组件**：

  1. **聚簇索引隐藏列**：`DB_TRX_ID`（6B，最后修改该行的事务 ID）、`DB_ROLL_PTR`（7B，回滚指针，指向 `Undo Log` 上一历史版本构成单向版本链；无主键时还有 6B `DB_ROW_ID`）。

  2. **`Undo Log` 版本链**：普通一致性快照读不加行锁，若当前记录版本不可见，顺 `DB_ROLL_PTR` 按需重构历史版本；长事务不提交会导致老 `ReadView` 一直存活，`purge` 线程无法清理旧 `Undo` 导致版本链膨胀拖慢查询。

  3. **`ReadView` 四核心字段与可见性四步判断**（参考 [MySQL ReadView 源码](https://dev.mysql.com/doc/dev/mysql-server/latest/classReadView.html)）：

     * `m_creator_trx_id`（创建视图的当前事务 ID）、`m_ids`（创建视图瞬间活跃未提交的读写事务 ID 列表）、`m_up_limit_id`（活跃列表最小值，低水位）、`m_low_limit_id`（系统下一个待分配事务 ID，即当前最大事务 ID + 1，高水位）。

     * 对某行 `trx_id`：① `== m_creator_trx_id`（自己改的）→ **可见**；② `< m_up_limit_id`（建视图前早已提交）→ **可见**；③ `>= m_low_limit_id`（建视图后才开启的未来事务）→ **不可见**；④ 落在 `[m_up_limit_id, m_low_limit_id)` 区间 → 查是否在 `m_ids` 中，**在则当时未提交不可见，不在则已提交可见**。

  * **`RC` vs `RR` 核心区别**：**`READ COMMITTED` 每次执行普通 `SELECT` 都重新生成一个新的 `ReadView`**（故能立刻看到别人刚提交的修改）；**`REPEATABLE READ` 仅在该事务第一次执行普通 `SELECT` 时生成 `ReadView` 并后续全程复用**（注意：`BEGIN / START TRANSACTION` 那一刻并未拍快照，除非显式写 `START TRANSACTION WITH CONSISTENT SNAPSHOT`）。

  * **快照读 vs 当前读与 `RR` 幻读边界**：普通 `SELECT` 是快照读靠 `ReadView`；`SELECT ... FOR SHARE`、`SELECT ... FOR UPDATE`、`INSERT / UPDATE / DELETE` 全部是**当前读**，必须读取最新已提交版本并加锁。`RR` 下连续快照读不产生幻读，当前读靠 **临键锁（`Next-Key Lock` = 记录锁 `Record Lock` + 前开间隙锁 `Gap Lock`）** 锁住扫描区间禁止并发插入防幻读；但若先快照读没看到某行、别人插入提交后自己执行 `UPDATE` 当前读改了那行，后续再快照读就会因为 `trx_id == m_creator_trx_id` 突然看到这行（混合读写幻读现象），且两个事务读同一约束改不同行的写偏斜（Write Skew）在 `RR` 下仍会发生。

* **高频补充：InnoDB 锁粒度、行锁升级全表风险与死锁定位**：

  * **意向锁（IS / IX）**：表级锁，用于快速告诉后续想加表锁的 DDL/操作「表里已有行被锁」，免去逐行扫描检查冲突。

  * **无索引条件更新锁全表**：InnoDB 行锁实际加在**索引记录**上；如果 `UPDATE / DELETE` 的 `WHERE` 条件未命中任何索引（或发生隐式转换索引失效），会退化为沿聚簇索引全表扫描并对所有扫描到的记录加锁（RR 下还会加间隙锁），直接堵死整张表的并发写。

  * **线上死锁排查**：执行 `SHOW ENGINE INNODB STATUS` 查看 `LATEST DETECTED DEADLOCK` 段，直接定位两个冲突事务持有的锁（`HOLDS THE LOCK(S)`）、等待的锁（`WAITING FOR THIS LOCK`）及回滚牺牲者；死锁线程处于锁等待态，通常 **CPU 占用不高**。

#### 3. 项目落地：核心并发锁与状态控制场景

1. **场景一（制造业）：为什么 `notify_task` 领单短事务显式切 `READ COMMITTED` + `FOR UPDATE SKIP LOCKED`？**

   * **防间隙锁卡死新告警插入**：领单查询走非唯一联合索引 `(status, priority, next_run_at)` 范围扫描。若保持默认 `RR`，加锁读会对扫描到的索引区间加上 `Gap Lock / Next-Key Lock`，此时车间新上报一条告警要 `INSERT` 进 `PENDING` 对应时间间隙时会被领单事务无辜阻塞；显式切为 **`READ COMMITTED`**（配合 `binlog_format=ROW` 保证主从复制安全）后，InnoDB 退化为**只锁命中的单行记录而不锁间隙**。

   * **多实例零等待并行抢单**：普通 `FOR UPDATE` 在双实例同时扫到队头第一条 P0 任务时，实例 B 会阻塞干等实例 A 提交；加上 MySQL 8 原生 **`SKIP LOCKED`**（参考 [InnoDB Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)）后，实例 B 发现首行已被锁，**零阻塞立即跳过锁下一条到期行**。

   * **跨表死锁消除**：领单已锁住子表 `notify_task` 行，复核父表 `anomaly_round` 是否已人工确认时，在 `RC` 下只做**普通无锁快照读**而不反锁父表；而人工确认先锁父表再按**聚簇主键升序**批量取消待发子单，彻底斩断「子等父、父等子」的死锁等待环。

2. **场景二（NoteWeave 职责 1）：`Table-as-State` 并发写表统一锁序与 `supremum` 伪记录防护**

   * **四表全局单向升序锁序**：所有写回短事务严格遵循 `research_run`（主键）→ `research_subtask` → `research_cell`（多格按聚簇主键升序 `FOR UPDATE`）→ 关联 `doc_source`（聚簇主键 `IN (...) FOR SHARE` 当前读核验 `status='ACTIVE'` 且 `proc_version == current_version`）。破坏死锁四大必要条件中的「循环等待」，杜绝 `Error 1213` 死锁。

   * **离散主键点查与 `supremum` 防护细节**：单次引用资料 `IN (...)` 个数远小于 `eq_range_index_dive_limit=200`，虽然 `EXPLAIN` 显示 `type=range`，但 InnoDB 底层实际按主键升序执行**离散唯一主键等值点查**而非连续区间扫。**致命盲区**：若大模型幻觉编造了一个比当前最大文档 ID 还大的不存在 `doc_id` 放进 `IN (...) FOR SHARE`，在 `RR` 下唯一主键等值未命中会锁住页内无穷大伪记录 **`supremum` 的间隙锁**，直接把全系统新上传文档的自增主键 `INSERT` 全部卡死。因此我们在**事务外的第一层 Java 规则校验里先剔除不存在的幻觉 `doc_id`**，且撤回资料采用软删除不物理删行，使事务内 `FOR SHARE` 100% 精确命中存在主键，退化为 `LOCK_REC_NOT_GAP` 纯单行共享锁。

3. **场景三（制造业职责 4）：HITL 草稿为什么阶段一领单就递增 `version`，阶段三写回为什么要对父轮次加 `FOR SHARE`？**

   * **防超时回收重派下的 `ABA` 覆盖**：若领单不加 `version`，Worker 1 领走 `version=1` 后卡顿 `95s`；第 `90s` 守护线程将其超时重置回待生成，Worker 2 领走仍处于生成中（`version` 若还是 `1`），第 `95s` Worker 1 醒来执行 `WHERE id=? AND version=1` 就会误匹配成功覆盖状态。因此**每次执行权转移（领单、90s 超时回收、人工接管编辑、批准）都原子 `version + 1`**，彻底拦截慢线程写回。

   * **父表 `FOR SHARE` 防关单竞态**：模型在事务外生成草稿耗时约 `7.2s`，期间现场可能已经修好复机关闭了父异常轮次（子表自己的 `version` 感知不到父表变化）。阶段三写回短事务按「先父表后子表」顺序先对父表 `anomaly_round` 加 **`FOR SHARE` 共享读锁**做当前读确认轮次仍存活，防止读锁期间并发关单，再 CAS 写回子表草稿。

#### 4. 面试口述与连环追问

> **【面试口述】**我在两个项目里针对不同访问形态用了不同的隔离级别和锁策略。在制造业通知领单上，因为走的是非唯一联合索引范围扫描，如果用默认的 `RR`，加锁读会挂临键锁把间隙锁死，导致新进来的设备告警插入阻塞，所以我用 `TransactionTemplate` 显式切到 `READ COMMITTED` 配 `ROW` 格式 `binlog`，只锁命中单行不锁间隙，并加上 MySQL 8 的 `FOR UPDATE SKIP LOCKED` 让双实例遇到被锁行直接跳过零等待并行抢单。而在 NoteWeave 并发写研究状态表时，我严格规定按『主记录 → 子任务 → 格子主键升序 → 资料主表 `IN` 共享锁』单向加锁破除循环等待，并且专门在事务外第一层规则剔除不存在的幻觉文档 ID，防止 `RR` 下唯一主键未命中锁住页尾 `supremum` 伪记录阻塞新文档上传，让锁退化成最轻的 `LOCK_REC_NOT_GAP` 单行锁。

* **追问：MySQL 默认的 `REPEATABLE READ` 到底有没有彻底解决幻读？能不能现场给我举一个出现幻读的 SQL 序列？**

  > **答**：没有百分百消除，只能说在纯快照读或者纯加锁当前读下防住了大部分幻读，但在**先快照读、后当前读修改**的混合事务里依然会出现幻读。具体时序很简单：事务 A 开启后先执行普通 `SELECT * FROM t WHERE id = 5`，此时没有这行，生成并复用了 `ReadView`。接着事务 B 插入 `id = 5` 的新行并提交。如果事务 A 一直只做普通 `SELECT` 确实看不到它，但如果事务 A 紧接着执行了一条 `UPDATE t SET name = 'x' WHERE id = 5`，因为 `UPDATE` 是当前读，能看到 B 已提交的新行并成功把这行的隐藏 `DB_TRX_ID` 改成了事务 A 自己的 ID。随后事务 A 再执行刚才一模一样的普通 `SELECT`，根据 `ReadView` 规则『自己修改的记录对自己可见』，`id = 5` 这行就突然凭空冒出来了。要想从开启事务起防住这种竞争，一开始查询就得加锁走当前读。

### 2.4 `Redo / Undo / Binlog` 两阶段提交、主从复制与主库权威复核

#### 1. 核心定位与常考主线

面试必考：为什么配了「双 1」掉电不丢已提交事务？`Doublewrite Buffer` 防什么？崩溃恢复怎么看 `prepare` 状态？NoteWeave 职责 2「**MySQL 批量复核权威状态**」为什么必须强制路由主库而不能走从库？

#### 2. 底层机制与高频考点

* **WAL、双写缓冲与内部两阶段提交（2PC）**：

  * **WAL 与页断裂（Partial Page Write）防护**：事务提交不必同步随机刷写 `16KB` 脏数据页，只需顺序写日志。但后台刷脏页时，InnoDB 页是 `16KB` 而 Linux 文件系统页是 `4KB`，刷到一半断电会导致磁盘页半新半旧损坏；而 `Redo Log` 采用**物理逻辑日志（Physiological Logging：物理到页号，逻辑到页内修改操作）**，底页损坏则无法重放 `Redo`。因此刷脏前先顺序批量写入 **`Doublewrite Buffer`（`.dblwr`）** 备份完整页，恢复时若校验和损坏先用双写副本修好底页再重放 `Redo`（参考 [InnoDB Doublewrite Buffer](https://dev.mysql.com/doc/refman/8.4/en/innodb-doublewrite-buffer.html)）。

  * **`Redo Log` 与 `Binlog` 两阶段提交及崩溃恢复**：① InnoDB 写 `Redo Log` 置为 `PREPARE` 态（记录内部事务号 `XID`）；② Server 层写完整 `Binlog`（附同一 `XID`）；③ InnoDB 将 `Redo` 置为 `COMMIT` 态。崩溃重启恢复时，遇到处于 `PREPARE` 但未见 `COMMIT` 标记的事务，**拿 `XID` 去有效 `Binlog` 中核对——存在完整 `Binlog` 事务则自动补齐提交，不存在则用 `Undo Log` 回滚**，保证主库引擎与从库订阅的 `Binlog` 严格一致。

  * **双 `1` 持久化与三阶段组提交**：`innodb_flush_log_at_trx_commit = 1`（每次提交 `Redo` 刷盘）+ `sync_binlog = 1`（每次提交组 `Binlog` 刷盘），底层通过 **`Flush -> Sync -> Commit`** 三阶段队列由每批 Leader 线程合并多次事务做单次 `fsync`，兼顾零丢单与高并发吞吐。

* **高频补充：`Binlog` 三种格式与主从延迟治理**：

  * **`STATEMENT` / `ROW` / `MIXED` 对比**：`STATEMENT` 记原始 SQL 体积小，但含 `NOW()`、`UUID()` 或在 `RC` 隔离级别下容易导致主从数据不一致；`ROW` 记录每行变更前后镜像，日志稍大但绝对一致且是 Canal 订阅与 `RC` 隔离级别的必备配置；`MIXED` 自动切换。现代高可用集群统一开启 **`GTID`（全局事务标识）**，故障切主时自动对齐复制位点免手工算文件名偏移量。

  * **主从延迟四大治理手段**：① 写后强一致读（如撤回校验、支付结果）显式路由主库；② 开启从库 `WRITESET` 并行复制提高回放吞吐；③ 拆分大事务与批量写，避免单条大事务拖慢从库应用；④ 非强一致读走缓存或基于 GTID 位点等待同步。

* **主从复制链路与主库复核必然性**：

  * 链路：主库写 `Binlog` → 从库 `I/O receiver` 线程拉取写本地 `relay log` → 从库 `SQL applier`（可多线程并行）重放修改。

  * **半同步复制边界**：即便开启半同步（Semisync），主库等待从库返回的 `ACK` **仅代表从库已收到日志并刷入 `relay log`，并不代表 `applier` 线程已经在从库执行完该事务**（且超时还会自动退回异步）。因此用户刚撤回一份机密资料（`T+0` 主库提交 `status='REVOKED'`），`T+50ms` 发起问答，从库完全可能还停留在 `ACTIVE` 旧状态。

  * **NoteWeave 落点**：精排后的 Top-6 候选提取去重 `doc_id`（最多 6 个），通过 `@MasterRoute` 数据源路由**显式直连 MySQL 主库**做聚簇主键 `IN (...)` 批量点查（免回表，实测 `20 QPS` 下仅耗 **`1～2ms`**），并开启新快照（`RC` 或新短查询）核验 `status='ACTIVE'` 且切片携带的 `proc_version == current_version`，构筑撤回一致性的最终防线。

#### 3. 面试口述与连环追问

> **【面试口述】**MySQL 单机提交不丢数据靠双 `1` 配置、两阶段提交和双写缓冲协同：提交时先写 `Redo` 进 `PREPARE`、再刷 `Binlog`、最后改 `Redo` 为 `COMMIT`，并靠组提交批量合并 `fsync` 摊薄磁盘开销。万一在二三步之间断电，重启时拿内部 `XID` 去 `Binlog` 核对，完整就提交、不完整就用 `Undo` 回滚。而后台异步刷 `16KB` 脏页靠 `Doublewrite Buffer` 解决 `4KB` 系统页撕裂导致 `Redo` 无法重放的问题。至于主从复制，哪怕开了半同步，从库回 `ACK` 也只是写进了 `relay log` 还没真正应用生效，所以在 NoteWeave 资料撤回链路最后一步，我对精排完的前 6 条候选去重资料 ID 强制路由直连 MySQL 主库走聚簇主键 `IN` 批量点查，只花 1 到 2 毫秒就能避开复制延迟，守住撤回后新提问不漏出废切片的底线。

* **追问：既然崩溃恢复已经有 `Redo Log` 了，为什么刷脏页前还要多此一举写一次 `Doublewrite Buffer`？断电坏了直接重放 `Redo Log` 不就行了吗？**

  > **答**：核心原因是 `Redo Log` 不是纯物理整页镜像，而是物理到页、逻辑到页内行操作（Physiological Logging）的日志——比如它记的是『在第 88 号页偏移某处插入某条记录并调整槽位指针』，重放的前提是磁盘上那个 88 号基础页本身必须是结构完好的一致性旧页。但 InnoDB 一页是 `16KB`，操作系统文件系统一页是 `4KB`，后台刷脏写到前 `8KB` 突然掉电，磁盘上就会留下前一半新、后一半旧的断裂坏页（Partial Page Write），校验和直接挂掉，连页内目录都坏了，根本没法在上面重放逻辑 `Redo`。有了顺序写的双写缓冲备份完整 `16KB` 页后，重启发现磁盘页校验和损坏，就先拿双写区的完好副本覆盖修复底页，再重放 `Redo Log` 追平。

### 2.5 `PostgreSQL (pgvector)` 工业多模检索与预过滤索引设计（`B-Tree + GIN` vs `HNSW`）

#### 1. 核心定位与常考主线

简历实习经历技术栈包含 **`PostgreSQL (pgvector)`**，职责 3 写到：「**按设备型号、版本与片段级适用范围预过滤，经故障编码、全文与向量三路召回**」。高频深问点：为什么不用专门的 Milvus / ES？为什么 3 万条切片故意**不建 `HNSW` 向量索引**？3,000 条外部存储向量扫描怎么跑进 `10ms` 以内的？

#### 2. 底层机制与项目容量账本

* **为什么向量检索怕「先全局 ANN 再后过滤（Post-filtering）」？**

  * 工业合编手册里，老款通用型号的切片占大多数，某台特定改款机型（如 `DX-560B` 固件 `v3.2`）的合规切片可能只占全库的 5%～10%，且正文表述与相邻型号高度雷同。

  * 如果在全局 `HNSW` 图上先搜近邻 `Top-20`，再按机型和固件版本过滤，前 20 个名额经常被老型号切片挤占殆尽，过滤完变成 **0 条或仅剩 1 条（召回坍塌 / 滤空问题）**；而早期 `pgvector` 在高选择性过滤条件下若选错执行计划走图遍历，或后期迭代扫描跨度过大，延迟与召回稳定性反而不如精确位图过滤。

* **四列复合 `B-Tree` + 三个 `GIN` 倒排索引 + `120MB` 常驻内存精确余弦计算**：

  1. **硬预过滤索引组合**：标量范围建四列复合 `B-Tree` **`(device_category, batch_no, fw_min, fw_max)`**（首列设备大类等值先把 3 万条收窄到几千条，后三列在索引页内完成知识批次与固件上下界判定）；多值数组与全文建 3 个 **`GIN`（Generalized Inverted Index）倒排索引**——适用子型号数组 `model_codes`、关联故障码数组 `fault_codes`、`zhparser` 工业自定义词典 `tsvector` 分词列。

  2. **`BitmapAnd` 零退化执行路径**：因 **3 万切片阶段故意不建 `HNSW` 索引**，PG 优化器 100% 确定性地选择 `BitmapAnd(B-Tree, GIN)` 位图按位与求交，筛剩 `2,000～4,000` 条合规切片。该位图仅几十 KB，远低于 PG 默认 **`4MB work_mem`**，全程保持精确行指针（Exact TIDs）而不会退化为 `lossy` 整页重扫，随后 `Bitmap Heap Scan` 精确计算余弦距离 `<=>` 取 `Top-20`（零近似图搜索召回损失）。

  3. **为什么 `TOAST` 外部存储不慢且 `<10ms`？** `1024` 维 `float32` 向量单条占 `4KB`，采用 `pgvector` 默认非压缩 `STORAGE EXTERNAL` 免去无收益的 LZ4 解压 CPU 开销；全库 **`30,000 × 4KB ≈ 120MB`**，整张向量 TOAST 表稳稳常驻在 PG `shared_buffers` 共享内存中，全程纯内存顺序/位图读取加 SIMD 指令内积运算，实测仅几毫秒。

  4. **连接池安全细节**：独立 HikariCP 只读池 `max=10`，每次查询在只读事务块内执行 **`SET LOCAL statement_timeout = '800ms'`**——用 `SET LOCAL` 而非会话级 `SET`，保证事务结束归还连接时自动恢复默认超时，绝不污染池中物理连接误杀后续查询。

* **高频补充：MySQL 与 PostgreSQL 的 MVCC 底层差异及向量库选型边界**：

  * **MVCC 存储差异**：InnoDB 将旧版本剥离到独立 `Undo Log` 表空间，原地更新聚簇页；PostgreSQL 则将更新后的新版本元组直接追加写入堆表页，旧版本保留在堆页中标记为死元组（Dead Tuple），依赖后台 `VACUUM / Autovacuum` 回收空间——因此 PG 长事务更易引发**表膨胀（Table Bloat）**，更新高频的表需调优 `fillfactor` 促进 HOT 更新。

  * **什么时候从 `pgvector` 迁往独立向量库（Milvus / Qdrant）？** 百万级以下、且需要强标量/权限过滤与关系表同事务一致的场景，复用 PostgreSQL 运维与成本优势极大；超过千万级高并发向量写入、需要分布式分片独立扩缩容和磁盘量化索引（DiskANN / PQ）时，再引入专用向量数据库。

#### 3. 面试口述与连环追问

> **【面试口述】**在制造业项目里，工业手册切片一共约 3 万条，我们复用了公司既有的 PostgreSQL 16 加 `pgvector` 和 `zhparser`。这里有个专门针对工业场景的设计：我们在 3 万条规模下**故意没有建 `HNSW` 向量索引**。因为同系列相邻改款机型的维修步骤长得很像但扭矩、液压参数不同，如果先在全局图上取近邻再过滤型号版本，名额很容易被老型号切片挤空。我们给设备大类、批次和固件上下界建了四列复合 `B-Tree`，给适用子型号数组、故障码数组和中文分词建了 `GIN` 倒排索引，让优化器稳定走 `BitmapAnd` 位图求交先硬筛出两三千条符合型号版本条件的切片（位图才几十 KB 远小于 `4MB work_mem` 不退化）。而 3 万条 1024 维 `float32` 向量用非压缩外部存储总共才 `120MB`，全部常驻 PG `shared_buffers` 内存免解压，直接算两三千次精确余弦距离不到 `10 毫秒` 就返回了，既没有近似图搜索的召回折损，也不会串用错型号参数。如果未来扩到几十万条，再开启 `pgvector 0.8` 的 `HNSW` 迭代过滤扫描（Iterative Index Scans）。

* **追问：为什么你在 PostgreSQL 只读连接池里每次查询要用 `SET LOCAL statement_timeout = '800ms'`，直接配连接级参数或者用普通 `SET` 有什么隐患？**

  > **答**：在连接池复用场景下，普通 `SET statement_timeout` 修改的是整条物理 TCP 会话级别的配置，事务提交把连接归还给 HikariCP 后这个超时依然留在连接上。如果某个特殊后台维护查询临时调大了超时，或者反过来某条连接改短了超时没在 `finally` 里复位，下一个借到这条连接的请求就会莫名其妙被超时误杀。而 PostgreSQL 的 `SET LOCAL` 作用域严格绑定在当前事务块内，一旦 `COMMIT` 或 `ROLLBACK` 结束事务归还连接，参数会自动重置回默认值，物理连接始终干净。

## 三、缓存与内存协调中间件深度考点（Redis 7 · ZSET 租约 · Lua 限流 · Stream · Cache-Aside 一致性）

### 3.1 `Redis` 高性能原理、线程模型与底层数据结构编码（`SDS` · `listpack` · `dict` · `跳表` · `Bloom Filter`）

#### 1. 核心定位与常考主线

两段经历把 Redis 的五大核心场景全部串了起来：并发槽位租约（`ZSET`）、通道令牌桶限流（`Hash + Lua`）、流式断线续读（`Stream`）、实时中断与失效广播（`Pub/Sub`）、防脏回填缓存与撤回墓碑（`String / ZSET / Hash`）。面试必从项目用法顺藤摸瓜问底层数据结构编码、单线程 vs IO 多线程、以及客户端选型。

#### 2. 底层机制与高频考点（参考 [Redis 7.2 Docs](https://redis.io/docs/latest/)）

* **为什么快与线程模型演进**：纯内存访问 + 高效紧凑底层编码 + Linux `epoll`（默认 `LT` 模式，见 [Redis ae_epoll.c](https://github.com/redis/redis/blob/unstable/src/ae_epoll.c)）非阻塞事件循环 + **核心命令执行主路径单线程串行**（省去多线程锁竞争与上下文切换，但也意味着 `KEYS *`、超大 `HGETALL`、长循环 Lua 会阻塞后续所有命令）。Redis 6.0+ 引入可配置的**网络 I/O 多线程**分担 Socket 读写与协议解析，后台还有异步刷盘（`BIO_AOF_FSYNC`）和惰性释放内存（`UNLINK` `BIO_LAZY_FREE`）线程，故严谨表述为「常规命令执行主路径单线程，网络读写与后台清理可多线程」。

* **Java 客户端选型（`Lettuce` vs `Jedis`）**：Spring Boot 默认用 **Lettuce**，底层基于 Netty NIO，**单条物理连接天然线程安全，多线程共享多路复用发送短命令**（阻塞命令如 `BLPOP / XREAD BLOCK` 或事务除外，需独立连接）；Jedis 基于阻塞 Socket，单连接非线程安全，必须配连接池。制造业中给 Lettuce 显式设 `200ms` 命令超时，防止主从切换期间挂住主线线程。

* **核心底层编码细节**：

  1. **`String` 与 `SDS`（Simple Dynamic String）**：相比 C 原生 `\0` 结尾字符串，SDS 显式记录已用长度 `len` 与分配容量 `alloc`，获取长度 `O(1)`、**二进制安全**（中间含 `\0` 不截断）、空间预分配防缓冲区溢出。三种编码：`int`（8B 长整型）、**`embstr`（长度 `<= 44 Bytes` 时，16B `redisObject` 头 + 取消字节对齐 `__attribute__((__packed__))` 的 3B `sdshdr8` 头 + 44B 内容 + 1B `\0` 恰好凑够 `64 Bytes` 单条 CPU 缓存行，只做一次连续内存分配；`embstr` 为只读编码，一旦 `APPEND` 修改立即转为 `raw`）**、`raw`（`> 44B`，两次独立内存分配，见 [Redis 7.2 object.c](https://github.com/redis/redis/blob/7.2.4/src/object.c)）。

  2. **`List / Hash / ZSet` 小对象紧凑编码 `listpack` 替代 `ziplist`**：早期 `ziplist` 每个节点存前驱节点长度 `prevlen`（`< 254B` 占 1B，`>= 254B` 暴涨为 `0xFE` + 4B 共 5B），一旦首部插入一个 `>= 254B` 的元素，可能引发后续一连串处于 250～253B 边缘的节点连续扩容重分配即**连锁更新（Cascade Update）**。Redis 7.0+ 全面改用 **`listpack`**（见 [antirez listpack 设计文档](https://github.com/antirez/listpack/blob/master/listpack.md)），每个节点只在自身尾部记录**自己的长度 `backlen`**（每字节最高位 `MSB` 作延续标志、尾部首字节 `MSB=0` 作反向定界符），既支持从尾向头反向遍历，又根除了跨节点连锁更新。List 大对象采用 `quicklist`（双向链表串多个 `listpack` 宏节点）。

  3. **`Hash` 大对象 `dict` 与渐进式 Rehash**：拉链法解决冲突，维护 `ht[0]` 与 `ht[1]` 两张哈希表及 `rehashidx`。扩容触发后（平时负载因子 `>= 1`；若正在跑 `BGSAVE / BGREWRITEAOF` 子进程，为减少 `COW` 写时复制内存翻倍，阈值提高到 **`>= 5`**），不一次性搬完，而在后续每次增删改查顺带搬 `rehashidx` 处一个桶：期间**新插入一律只进 `ht[1]`**，查/删/改先查 `ht[0]` 再查 `ht[1]`，避免漏查或重复。

  4. **`ZSet` 大对象 `dict + zskiplist`（哈希表 + 跳表）与 `double` 53 位精度边界**：

     * 为什么同时用两套结构？`dict` 支撑 `ZSCORE` 按成员 `O(1)` 查分值；跳表（Skiplist）按 `(score, member 字典序)` 有序排列并维护前向指针跨度 `span`，支撑 `O(log N + M)` 范围查询 `ZRANGE` 与 `O(log N)` 累加 `span` 算排名 `ZRANK`（两者共享成员 `SDS` 指针不双倍拷贝内容；相比红黑树，跳表范围遍历只需顺底层双向链表走，实现更简洁直观，见 [Redis 7.2 t_zset.c](https://github.com/redis/redis/blob/7.2.4/src/t_zset.c)）。

     * **高频深水区：`score` 复合排序精度陷阱**：ZSet 的 `score` 是 IEEE 754 **64 位 `double` 浮点数**，尾数有效精度仅 **53 bit**，能连续精确区分无精度丢失的最大整数范围是 **`[-2^53, 2^53]`（约 `9.007 × 10^15`）**。因此**绝不能把两个任意 32 位整数直接拼成 64 位塞进 `score`**，超出 `2^53` 后相邻整数会坍缩为同一个浮点数导致同分乱序；要做「积分优先、同分早到优先」混排时，必须用相对于活动起点的有界秒数差并验算 `p_max × B + s_max ≤ 2^53`。

  5. **`Bloom Filter`（布隆过滤器）空间推导与工程禁区**：`m` 位 bit 数组配 `k` 个独立哈希函数，对已正确同步集合**无假阴性（判不存在则一定不存在），有假阳性（判存在可能误判）**，给定容量 `n` 与误判率 `p` 时 `m ≈ -(n × ln p) / (ln 2)²`，`k ≈ (m / n) × ln 2`（如 1000 万元素、1% 误判率仅需约 `11.43 MiB`，`k ≈ 7`，见 [Redis Bloom Filter](https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/)）。标准布隆不支持单元素清零删除（会连累共享位的其他元素产生假阴性）。**NoteWeave 反例**：向量化批次汇聚去重**严禁使用布隆过滤器**——一旦某个真实批次撞上千分之一假阳性被误判为已处理跳过，文档主表已完成批次计数就会永远少 1，整份资料永久卡在中间态进不了 ES。

* **高频补充：过期删除策略与 8 种内存淘汰策略**：

  1. **过期删除（惰性删除 + 定期随机抽样）**：访问 key 时若已过期当场删除（省 CPU 但冷 key 长期不访问会占内存）；配合后台默认每秒 10 次随机抽查 20 个带 TTL 的键删除过期项，若本轮过期比例 >25% 则循环继续抽查（设执行时间上限防卡顿主线程）。

  2. **内存触及 `maxmemory` 时的 8 种淘汰策略**：默认 `noeviction`（只读不写直接报错）；按范围分为 `allkeys-*`（全库键）与 `volatile-*`（仅带过期时间键），按算法分为近似 `lru`（采样池挑最久未访问）、`lfu`（4.0+ 24-bit `lru` 字段拆为 16-bit 分钟时间戳 + 8-bit 对数访问频次计数，抗偶发扫描污染）、`random` 及 `volatile-ttl`（优先淘汰剩余寿命最短的键）。制造业流控实例采用 `volatile-ttl` 保护长寿命流控键，NoteWeave 缓存采用 `volatile-lfu` 留住热正文页。

#### 3. 面试口述与连环追问

> **【面试口述】**Redis 快在纯内存、紧凑编码、`epoll` 多路复用加核心命令单线程无锁竞争，6.0 以后引入的多线程只分担网络 IO 读写和协议解析，命令执行主线依然串行。底层编码上我重点关注三块：一是 `SDS` 长度不超过 44 字节走只读 `embstr`，利用取消字节对齐的 3 字节 `sdshdr8` 加 16 字节对象头和结尾符正好凑够 `64 字节` CPU 缓存行。二是 Redis 7 用 `listpack` 把节点自身长度放尾部逆向定界，解决了老版 `ziplist` 超过 254 字节引发的级联更新。三是 `ZSet` 小规模走 `listpack`（比如 NoteWeave 工作区 4 槽租约只有 4 个元素），超阈值转 `dict` 加跳表，但要注意它的 `score` 是 64 位 `double`，连续精确整数上限只有 `2^53`，不能盲目拼两个 32 位整数。

* **追问：线上监控发现平时不到 `1ms` 的简单 `GET` 命令偶发飙到 `50ms` 毛刺，不用 `KEYS *` 的前提下你怎么一步步定位根因？**

  > **答**：先排除客户端与网络，再查服务端主线程阻塞。第一步看客户端侧是不是连接池耗尽排队或自身 Full GC 停顿，用 `redis-cli --intrinsic-latency` 和 `--latency` 区分网络抖动还是 Redis 内部慢。第二步调 `SLOWLOG GET` 和 `INFO commandstats` 看当时前序是不是刚跑过慢命令（比如 `HGETALL` 大 Hash、`SUNION`、长 Lua 脚本或一次性同步 `DEL` 几百万元素的大 Key 阻塞了单线程）。第三步如果 `SLOWLOG` 里干干净净（因为 `SLOWLOG` 只记命令执行耗时），就查 `INFO stats` 里的 `latest_fork_usec` 看是不是 `BGSAVE` 或 `AOF Rewrite` `fork` 子进程复制大页表卡住了主线程，同时检查宿主机是否未关闭透明大页 `THP`（会导致 `fork` 后写时复制按 `2MB` 大页拷贝放慢几十倍）以及 `AOF everysec` 是否因磁盘 IO 打满拖阻塞了主线程 `write`。

### 3.2 `Redis ZSET 租约`、`Fencing Token` 与并发写回防护

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 1 明确写到：**「以 Redis ZSET 租约管理并发槽位、Fencing Token 拒绝过期执行者写回」**。高频深问点：为什么不用 `INCR / DECR` 计数器或 Redisson 分布式锁？租约都有过期时间了，为什么还非要加 `Fencing Token`？

#### 2. 底层机制与故障时序推演

* **为什么 `INCR / DECR` 和普通分布式锁不够？**

  1. **`INCR / DECR` 崩溃漏减**：工作区限 4 个并发槽，Worker `INCR` 占槽后若遭遇 `kill -9` 或容器 OOM 重启，来不及执行 `DECR`，槽位永久泄漏；而整个计数器设统一 TTL 又会把正在正常跑的其他任务计数一并清零。

  2. **Redisson 看门狗 / Redlock 挡不住进程停顿覆盖写**：分布式锁或租约只能管理「当前谁有资格领任务」，一旦持有者 A 遭遇长达几十秒的 Full GC STW 或网络分区导致锁/租约到期，执行者 B 合法接管并写完新结果；随后 A 醒来，它的代码并不会因为 Redis 里的键过期而自动终止，A 拿着旧上下文照样向 MySQL 发 `UPDATE`，直接把 B 的新结果覆盖掉（参考 [Redis Distributed Locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)）。

* **高频补充：标准 Redis 分布式锁三要素与 Redlock 争议**：

  * **单实例分布式锁三要素**：① 加锁必须单条原子命令 `SET lock:key <unique_val> NX PX 30000`（严禁拆成 `SETNX + EXPIRE` 两条命令防中途宕机死锁）；② value 存全局唯一标识（UUID + 线程/实例 ID）；③ 解锁用 Lua 脚本原子完成「校验归属值相等 → `DEL`」防止误删他人新锁。

  * **Redisson 看门狗与 Redlock 争议**：Redisson 后台看门狗每 `TTL/3`（默认 10s）自动续期解决业务超长提前释放问题；Redlock 通过向 5 个独立主节点顺序加锁获多数派（≥3）试图规避单主异步复制切主丢锁，但仍依赖各节点物理时钟不发生大幅跳跃，且**无法阻止客户端长 GC 停顿醒来后的迟到覆盖写**——因此强一致写回场景必须像 NoteWeave 这样在存储层校验单调递增 `Fencing Token` 或改用基于 Raft 共识的 `etcd / ZooKeeper`。

* **NoteWeave「Redis 管准入数量 + MySQL `Fencing Token` 管写回正确性」双层闭环**：

  1. **`Redis ZSET` 4 槽滑动租约（Lua 原子执行）**：每个工作区一个键 `ws:slot:{wsId}`（深度研究与产物生成共用 4 槽），`member` 为每次派发生成的唯一 `lease_token`，`score` 为到期毫秒时间戳。

     * **准入 Lua**：调服务端 `TIME` 统一时钟 → `ZREMRANGEBYSCORE key -inf now` 剔除已崩溃/超时槽位 → `ZCARD key < 4` 则 `ZADD key (now + 300000) lease_token` 占槽成功（`300s` 过期）。

     * **续期 Lua（防僵尸复活）**：活跃执行者每 `60s` 调 Lua，**必须先验 `ZSCORE key lease_token > now`（确认自己还在且未过期）才用 `ZADD XX` 顺延 `300s`**，绝不能无条件 `ZADD` 把已被踢掉的旧令牌重新塞回集合。

  2. **MySQL 权威端单调 `Fencing Token` 与写回两支分流（防 300s 槽位泄漏）**：

     * 每次派发或超时重派都在 MySQL 研究主记录上原子递增签发单调代次 `fencing_token` 并写入子任务表。

     * **写回短事务两支精准分流**：

       * **分支 A（超时僵尸执行者）**：当子任务已非 `RUNNING` 态，或传入令牌与子任务当前有效令牌不相等时，说明已被超时回收重派给新执行者——**整事务回滚，且严禁调 `ZREM` 触碰 Redis 槽位**（它自己的旧成员早已自然过期清理，乱碰会误伤别人）。

       * **分支 B（当值合法执行者遇业务重规划/资料升版）**：当子任务确系 `RUNNING` 且令牌匹配，但发现目标父格已拆细 `ARCHIVED`、计划已升版，或关联 `doc_source` 资料已撤回/重传升版（`proc_version != current_version`）——主控**不写格子结论，但正常提交短事务结清该子任务状态，并立即调 `ZREM` 释放它持有的 `lease_token` 槽位**（资料变更时将格子置为 `待重验` 且不扣减单格 3 次补查配额），杜绝有效槽位白白死占 `300s`。

       * **正常采纳**：子任务令牌匹配 + 计划版本未变且格子非 `ARCHIVED` + **`incoming_fencing_token > cell.last_fencing_token`（高水位拦截状态倒退）** + 引用资料有效且版本一致 → 落库推进水位后立即 `ZREM` 释槽。

#### 3. 面试口述与连环追问

> **【面试口述】**我把并发治理拆成了『准入数量』和『写回正确性』两层。数量层用 Redis `ZSET` 管每个工作区 4 个槽位，成员是唯一 `lease_token`、分值是 `now + 300 秒` 到期时间戳，Lua 脚本调服务端 `TIME` 先清过期成员再判满准入，每 60 秒验未过期才续期，解决了普通 `INCR/DECR` 实例崩溃漏减死占槽位的问题。但任何 Redis 租约或 Redisson 锁都防不住执行者长 GC 停顿醒来后覆盖写库，所以正确性层我下沉到 MySQL 权威端，每次派发单调递增签发 `Fencing Token`，在单条写回短事务里同时核验子任务令牌一致、计划版本未变且传入令牌严格大于格子最后写入水位。而且我还把拦截拆成两支：已被超时重派的僵尸执行者直接回滚不碰 Redis，而当值执行者如果遇到拆格或资料重传升版，正常结清子任务并立刻 `ZREM` 释放自己的槽位，避免 300 秒槽位空占。

* **追问：为什么你的 Redis ZSET 租约成员不用 `subtask_id`（子任务 ID），而专门在每次派发时新生成一个唯一 `lease_token`？**

  > **答**：这是为了防超时重派时的『跨代误删租约』。假如某次重派复用了同一个任务 ID 做 ZSET 成员：旧执行者 A 超时后，它的成员过期被清掉，新执行者 B 用同一个任务 ID 重新 `ZADD` 占了槽正在跑。此时慢悠悠醒来的旧执行者 A 如果在退出收尾代码里按任务 ID 调了一次 `ZREM` 或误做续期，就会把新执行者 B 正在使用的合法槽位直接删掉，导致第 5 个任务挤进来击穿 4 槽并发上限。每次领取生成全局唯一的 `lease_token` 后，不同代次的执行者在 ZSET 里物理隔离，互不误伤。

### 3.3 `Redis + Lua` 跨实例共享令牌桶限流与高可用降级

#### 1. 核心定位与常考主线

简历在制造业职责 2 明确写到：**「基于 Redis + Lua 实现跨实例共享的通道级令牌桶限流」**。面试必考：四种限流算法怎么对比？Lua 真的是数据库那种事务原子性吗？遇到下游 `429` 冷却期间键过期重置成满桶怎么防？Redis 哨兵主从切换或挂了怎么降级？

#### 2. 底层机制与项目深度设计

* **四大限流算法系统设计对比**：

  1. **固定窗口计数器（Fixed Window）**：实现最轻，但存在致命**窗口交界双倍突刺**（前 1 分钟最后 1 秒打入 100 次、后 1 分钟第 1 秒又打入 100 次，2 秒内实际放行 200 次冲垮下游）。

  2. **滑动时间窗口（Sliding Window Log / Buckets）**：ZSet 逐请求日志法精确控任意连续 `T` 秒上限，但高限额下内存开销与 `ZREMRANGEBYSCORE` 删除成本高，且**仍允许在窗口第一毫秒瞬间把 100 个名额全用光**，不平滑突发。

  3. **漏桶（Leaky Bucket）**：请求先进队列，按恒定速率流出，能抹平毛刺，但**不支持突发流量**（车间平时安静，突然来 30 条告警也只能按慢速排队干等）。

  4. **令牌桶（Token Bucket，项目最终选择）**：以恒定速率 `r` 向容量 `B` 的桶补令牌（`T_new = min(B, T_old + r × Δt)`），既严格卡住长期平均速率不超过运营商合同配额（短信 `20/s`、语音 `2/s`），又允许利用桶内积攒余量（桶容量短信 `40`、语音 `4`）毫秒级瞬发吸收车间短时告警突发。

* **Redis Lua 原子性的准确边界**：Lua 脚本靠 Redis 单线程串行执行命令实现**隔离性（脚本运行期间不会穿插其他客户端命令）**，但**不具备关系型数据库的错误自动回滚（Rollback）语义**——若脚本前半段执行了写命令、后半段因参数非法报错中断，前半段的修改会留在内存里（参考 [Redis Lua Atomicity](https://redis.io/docs/latest/develop/programmability/eval-intro/)）。因此脚本必须**先校验所有参数合法性，最后再执行写操作**，且通过 `EVALSHA` 传摘要省带宽、禁止无界循环。

* **制造业生产级令牌桶三大关键细节**：

  1. **单 `Hash` 同槽与服务端时钟防漂移**：每个通道单 `Hash` 键存 `tokens`（余量）、`last_ms`（上次补桶毫秒）、`cooldown_until`（共享冷却截止时间），单键天然满足集群同槽；脚本内调 `redis.call('TIME')` 统一时钟并将偶发微回拨钳位为 `0`。

  2. **遇 `429` 清零余量 + 保底长 TTL 配 `volatile-ttl` 防二次 `429` 突刺**：告警侧先按异常轮次做**时间窗口聚合**，只保留首次、升级和恢复通知，避免设备抖动导致同一事件反复打扰；随后再进入下面的共享令牌桶与冷却处理。收到网关 `429 Retry-After` 时，写入共享 `cooldown_until` 并**同步把桶内剩余 `tokens` 清零**（确保冷却结束从 `0` 平滑爬坡）。同时若冷却长达几十分钟、各实例跳过请求未调 Redis 刷新过期时间，短 TTL 流控键一旦在冷却结束前自然过期或被淘汰，冷却结束首秒会按「键不存在冷启动」**瞬间重置出满桶 `40` 个突发令牌**再次打爆网关。故每次写入刷保底长过期 **`max(24h, cooldown_remaining + 1h)`**，并将 Redis 内存淘汰策略配为 **`volatile-ttl`**，使其优先淘汰仅 `5min` TTL 的旁路子 `BOM` 缓存，不动长寿命流控键。

  3. **Redis 故障 / Sentinel 切换降级**：Redis 主从异步复制下 Sentinel 切主最坏仅丢失最后几毫秒扣减（误差不超过一桶 `40` 条，对流控可接受，不开 `min-replicas-to-write` 牺牲可用性）；Lettuce 设 `200ms` 硬超时，一旦超时或断连立即自动切回双实例本地 **Guava `RateLimiter` 折半限流**（双机各放短信 `10/s`、语音 `1/s`，全局合计仍严守 `20/s` 与 `2/s` 配额）。

#### 3. 面试口述与连环追问

> **【面试口述】**运营商通道既要求长期均速不超标，又要能瞬发消化几十条突发停机告警，所以我选令牌桶而没选不支持突发的漏桶或有边界双倍突刺的固定窗口。实现上每个通道一个 Redis `Hash` 存余量、上次补桶毫秒和共享冷却截止时间，Lua 脚本里调服务端 `TIME` 原子补桶扣减，注意 Lua 只是单线程隔离执行、报错不回滚，所以要先验参再写。我还重点补了两个边界：一是收到网关 `429` 写冷却时间时同步把桶余量清零，并且设至少 `24 小时` 保底长过期配合 `volatile-ttl` 只淘汰 5 分钟的 BOM 短缓存，防止长冷却期丢键导致恢复瞬间重置满桶 40 条二次打爆网关。二是客户端配 `200ms` 超时，哨兵切换或断连期间自动降级为两台实例各自的本地 Guava 折半限流，全局总速率依然不超配额。

* **追问：你的令牌桶 Lua 脚本里为什么要调 `redis.call('TIME')` 拿时间，直接从 Java 应用传 `System.currentTimeMillis()` 进去省一次调用不行吗？**

  > **答**：多实例部署下严禁传客户端本地时间。我们的平台是双实例对等消费同一个 Redis 通道桶，如果实例 A 的机器时钟比实例 B 快了 `200 毫秒`：实例 A 扣完令牌把 `last_ms` 更新成了偏大的未来时间，紧接着 10 毫秒后实例 B 带自己偏小的本机时间戳进来算 `now - last_ms` 就会算出负数时间差，如果不钳位甚至会把令牌越算越少，或者反过来时钟跳变瞬间补满整桶。统一在 Lua 脚本内部调 Redis 服务端的单调时钟源并对微小回拨做零值保底，才能保证双机看到同一把尺子。

### 3.4 `Redis Stream`、`Pub/Sub` 与 `Last-Event-ID` 流式断线续读

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 4 写到：**「回答侧以幂等 Turn + Redis Stream 中转 SSE 解耦生成与连接，对 Stream 按条数裁剪，控制内存增长，支持基于 Last-Event-ID 的跨实例断线续读」**。面试必问：为什么不用 `Pub/Sub` 或 `List` 中转？`MAXLEN ~ 1000` 裁剪怎么工作？重连时怎么比对 `Last-Event-ID` 才能做到既不乱序误判、又不静默漏字？

#### 2. 底层机制与项目深度落地

* **三种 Redis 消息结构对比**：

  * **`Pub/Sub`**：纯内存即发即弃（At-most-once），客户端断网哪怕 1 秒，期间广播的 Token 永久丢失无法补读——**NoteWeave 仅用 `Pub/Sub` 发「用户点击停止生成」中断控制信号和「墓碑本地 1s 缓存失效广播」**，不用它传回答正文。

  * **`List`**：弹出消费（`LPOP/RPOP`）会删元素，无法支撑同一用户在手机和电脑双端同时订阅同一路流，也不支持按任意事件 ID 游标定位续读（`LRANGE` 只能按下标扫）。

  * **`Redis Stream`（基数树 Radix Tree 索引 `listpack` 宏节点）**：消息追加保留有序 ID，支持多路客户端通过 `XREAD BLOCK` 独立按各自的游标位点无损追尾读取（前端续读无需建重型 `Consumer Group`，避免 `PEL` 待确认列表维护负担），且 `XTRIM` / `XADD MAXLEN ~ 1000` 近似裁剪只在整块 `listpack` 宏节点可整体摘除时才释放内存，达到近 `O(1)` 高效限容（参考 [Redis XTRIM](https://redis.io/docs/latest/commands/xtrim/)）。

* **断线续读三大工程细节**：

  1. **`50ms` 微批聚合 + 显式 `1` 起始单调序号**：生成端每 `50ms` 攒一个增量块执行 `XADD sse:stream:{turnId} MAXLEN ~ 1000 {seq}-0 ...`（**Redis 协议规定 `0-0` 非法，显式从 `1-0, 2-0...` 单调递增**），写吞吐降一个数量级且人眼依然丝滑，每次刷新 `15min` 过期；同时每 **`5 秒`**（约 100 个微批，远小于 1000 条保留窗口）将累计全文前缀与对应序号 `cp_seq` 刷入 MySQL 检查点。

  2. **严禁字符串字典序比对 ID，严防 `XREAD` 静默跳读漏字**：浏览器断网重连自动带 `Last-Event-ID: 9-0`。若直接调 `XREAD STREAMS key 9-0`，万一断网太久 `10-0` 到 `50-0` 已被 `MAXLEN` 裁掉，Redis 会**静默直接从现存最早的 `51-0` 开始返回**，前端拼出来的文章中间就悄无声息缺了一大段；而如果先调 `XINFO STREAM` 拿当前首条 `first-entry` ID 跟 `Last-Event-ID` 做普通字符串比较，会出现 **`"9-0" > "10-0"` 为真**的字典序 Bug。

  3. **64 位整数拆解比对 + 三路分流无缝对齐**：网关先拆出两边 `-` 号前的 **64 位长整数 `long`** 做数值比较：① 若游标仍在 Stream 保留窗口内，直接 `XREAD` 续推并在首帧返回时二次断言 `frame_seq == cursor_seq + 1`；② 若游标已被裁掉且后台生成已完结，直接查 MySQL 终态全文一次性下发；③ 若游标已被裁掉但后台仍在生成中，先取出最新 `5 秒` 检查点封装为专用 `prefix_sync` 事件让前端整体覆盖对齐到 `cp_seq`，随即无缝续接 Stream 中 `> cp_seq` 的尾部增量（`5s` 仅百条，必在千条窗口内），故障注入实测与终态全文**逐字一致**。

#### 3. 面试口述与连环追问

> **【面试口述】**如果把流式生成直接绑在单机 HTTP 连接上，用户切 Wi-Fi 或网关滚动重启就会断流重算。我引入 `Redis Stream` 做生成与连接的中间缓冲：生成端按 `50ms` 微批用从 `1-0` 开始的单调序号写 Stream，配 `MAXLEN ~ 1000` 按整块 `listpack` 宏节点近似裁剪控内存，同时每 `5 秒` 往 MySQL 刷一次前缀检查点。用户点停止生成则走轻量的 `Pub/Sub` 广播切断上游流。重连带 `Last-Event-ID` 过来时有两个很容易踩的坑：一是如果直接调 `XREAD` 而旧位点已被裁掉，Redis 会静默从现存首条跳读导致中间漏字。二是查 `XINFO STREAM` 比首条 ID 时不能按字符串字典序比，否则 `'9-0'` 会大于 `'10-0'`。所以我拆出横杠前的 64 位整数比大小：窗口内直接续推并验首帧连续，超出窗口若还在生成中就先下发最新 5 秒检查点让前端整体覆盖前缀，再从检查点序号无缝接上 Stream 尾部。

* **追问：Redis Stream 原生自带 `XREADGROUP` 消费者组和 `PEL` 未确认列表，你在 SSE 断线续读里为什么不用消费者组而直接裸用 `XREAD`？**

  > **答**：因为两者的分发语义截然不同：消费者组是『竞争消费（负载均衡）』，一条消息发给组内消费者 A 后就不会再发给同组的 B，而且每条还得发 `XACK` 清理 `PEL` 挂起列表。但在 AI 工作台的流式回答场景里，同一个用户很可能同时在电脑网页和平板上打开同一个对话看实时生成，需要的是『多端独立广播追尾 + 各自按自己的 `Last-Event-ID` 游标回放』。直接用无状态的 `XREAD BLOCK` 配游标位点，既天然支持多端各自从任意位点无损续读，又省去了动态建组删组和维护 `PEL` 的内存开销。

### 3.5 `Cache-Aside 并发脏回填`、`Redis 墓碑`、`版本化 Key` 与缓存治理全集

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 2 集中考察了分布式缓存最硬核的深水区：**「针对资料撤销后的索引异步滞后与 Cache-Aside 并发脏回填，以 Redis 墓碑下推前置过滤、MySQL 批量复核权威状态及版本化 Key 隔离过期缓存写回，阻断最终一致窗口期的脏召回与旧值复活」**。

#### 2. 底层机制与故障时序推演（参考 [Meta Cache Consistency](https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/)）

* **为什么经典读写双写、先删缓存、甚至「先改库再删缓存」仍有脏数据？**

  1. **改库后直接改缓存**：并发写事务 A（v11）和 B（v12），A 先提交 DB 但网络卡顿，B 后提交 DB 先写完缓存 v12，A 恢复把旧 v11 覆盖进缓存。

  2. **先删缓存再改库（最易错）**：写请求 W 先删缓存尚未提交 DB，并发读请求 R 未命中读出 DB 旧值 100 回填缓存，W 再提交 120，缓存停留在脏值 100 直至过期。

  3. **标准 `Cache-Aside`（数据库事务提交后删缓存）的隐蔽慢读脏回填时序**：初始缓存刚好失效为空，**读请求 R 先未命中查到 DB 旧版 `v3` 后发生 GC/调度停顿 → 写请求 W 提交 DB 新版 `v4` 并成功执行 `DEL` 删缓存 → R 醒来把刚才手里的旧版 `v3` 重新 `SET` 回填进缓存（旧值复活）**。延迟双删（`sleep(500ms)` 再删一次）无法证明慢读一定在 500ms 内结束，读写分布式锁又把高并发读拖成串行。

* **NoteWeave 三套精准破局方案（按数据特征量体裁衣）**：

  1. **Wiki 页缓存：单调版本指针 + 不可变 `版本化 Key`（零锁防脏回填）**：

     * 将数据拆成「版本指针键 `wiki:ver:{pageId}`（TTL `10min`）」与「不可变版本正文键 `wiki:body:{pageId}:v{N}`（TTL `1h`，配 `volatile-lfu` 淘汰）」。

     * **更新侧**：先写好新版不可变键 `:v4`，再调 Lua 原子比较只有 `newVer > curVer` 才推高指针（写好新正文才切指针，无热点过期击穿）。

     * **慢读侧**：即便慢读线程停顿醒来回填，它写的也是异键 `:v3`，覆盖不了 `:v4`，而新读请求先读指针拿到 `4` 只读 `:v4`，把原地覆盖竞态转化为异键物理隔离（指针查库不存在写 `-1` 防缓存穿透）。

  2. **Context 编译控制块（第 2 段会话约束与第 6 段长期记忆）：状态指纹自变 Key**：

     * 键名直接对 `(session_id, constraint_ver)` 和 `(user_id, scope, active_mem_ver_set)` 做哈希指纹，状态一变自动切向新 Key，**全程不执行主动 `DEL`**，旧键靠 **`180s + 0～30s` 随机抖动 TTL** 自然回收（既物理隔离慢读脏回填又防集体到期缓存雪崩）。

  3. **资料撤回跨存储一致性：防 `ABA` 升版 + `Redis 墓碑`（`24h -> 60s` 缩期 + `1,024` 软水位）+ MySQL 主库复核**：

     * **防 `ABA`**：撤回、重传或恢复启用一律递增分配全新 `proc_version`，已撤回旧版本号永不原地复活。

     * **双端墓碑协同**：撤回事务提交后写工作区墓碑 ZSET `nw:tombstone:{wsId}`（`member = docId:oldVer`，`score = now + 24h` 保底），顺带清本机缓存并经既有 `Pub/Sub` 广播失效各实例本地 `1s` Caffeine 缓存；Kafka 异步清理消费者（距撤回不足 `2s` 先微等避开 ES `1s Indexing Buffer` 在途写段）调 ES `delete_by_query`，**仅当返回 `failures` 列表为空、确认删净 `< target_ver` 旧切片后，才经 Lua 将墓碑到期时间缩至 `min(oldScore, now + 60s)`**，精准覆盖 ES `1s refresh` 与 `index.gc_deletes=60s` 物理回收窗口。

     * **`1,024` 主动软水位**：虽然 ES `terms` 硬上限为 `65,536`，但实测墓碑超 `1,024` 条下推到 ES `bool.must_not` 与 `knn.filter` 时，JSON 序列化与位图构建延迟抬升，故设 `1,024` 为软水位——`<= 1,024` 双路下推 ES 预过滤保召回名额，`> 1,024` 改走 **`1s` 本地 Caffeine 短缓存 + 扩窗召回 + 内存 `HashSet` 过滤**（若主库复核剔除后结果被刚撤回长文挤空，立即绕过本地缓存重拉墓碑扩窗补检一次），最后经 MySQL 主库聚簇主键 `IN` 批量复核兜底。

* **高频补充：缓存穿透、击穿与雪崩三剑客系统闭环**：

  1. **缓存穿透（查根本不存在的数据，每次直打 DB）**：网关参数校验拦截非法 ID + 缓存空对象短 TTL（如版本指针写 `-1`）+ 大规模存在性判空前置布隆过滤器。

  2. **缓存击穿（单个超高并发热点 Key 过期瞬间全部回源）**：强一致库存/余额走互斥锁重建（抢锁线程回源，其余短暂等待重试）；允许极短弱一致的内容页走逻辑过期异步刷新，或像 NoteWeave Wiki 页这样用「先写不可变新版 Key + Lua 推高版本指针」彻底消除重建空窗。

  3. **缓存雪崩（大批 Key 同刻过期或 Redis 集群不可用）**：所有 TTL 必加随机抖动（如 `180s + 0~30s`）打散过期峰 + 多级缓存（本地 Caffeine 兜底）+ 熔断限流保护数据库。

* **大 Key 排障、持久化与集群高频速记点**：

  * **大 Key 治理（制造业实战故事）**：初版将全厂上万备件塞入单个大 `Hash` 调 `HGETALL` 引发毛刺，通过 `INFO commandstats`、`SLOWLOG` 与从库 `SCAN` / `--bigkeys` 定位后，按「机台选配编码 + 功能部件单元」拆为二三十项小 `Hash` 改 `HMGET` 按需读，旧大 Key 用 **`UNLINK` 后台异步释放内存**，并前置本地 **Caffeine（`W-TinyLFU`）** 一级缓存（命中率 `> 98%`）。

  * **持久化与高可用**：`RDB`（`BGSAVE` `fork` 期间主线程复制页表可能短暂微卡，共享物理页修改触发按页 `COW` 写时复制）+ **Redis 7 `Multipart AOF`**（拆分为 `base` 基线 RDB/AOF + `incr` 增量日志 + `manifest` 清单文件，`everysec` 正常约 1 秒窗口但磁盘阻塞会拉大）；Sentinel 区分主观下线 `SDOWN`、客观下线 `ODOWN`（达 `quorum`）与**执行切主必须获 Sentinel 多数派投票授权**；Redis Cluster 按 `CRC16(key) mod 16384` 分槽（`{tag}` 同槽但易引热点倾斜，永久迁完回 `MOVED` 刷路由，迁移中回 `ASK` 先发 `ASKING` 临时单次放行）。

#### 3. 面试口述与连环追问

> **【面试口述】**标准 `Cache-Aside` 先改库再删缓存，依然挡不住『慢读线程在写之前未命中读出旧版 `v3`、卡顿到写线程改完 `v4` 删完缓存后醒来把 `v3` 填回去』的并发脏回填。在 NoteWeave 里我没有用估不准时间的延迟双删，而是做了版本化 Key 隔离：Wiki 页缓存拆成单调版本指针键和 `:v3`、`:v4` 不可变正文键，先写好 `:v4` 再用 Lua 只往大推进指针，慢读就算迟到写的也是 `:v3` 异键，不加读写锁就隔离了旧值复活。针对资料撤回后 ES 异步刷段和删片滞后，我用 Redis 墓碑 ZSET 存 `docId:oldVer`，初写 `24 小时` 保底并经 `Pub/Sub` 清各节点 `1 秒` 本地缓存，等 Kafka 消费者调 `delete_by_query` 确认 `failures` 为空删净旧片后，再用 Lua 把墓碑缩期到 `60 秒` 覆盖刷段窗口。读侧 `1,024` 条以内直接下推 ES 预过滤防止废切片占掉向量近邻名额，超 `1,024` 软水位切本地短缓存扩窗过滤，最后对精排前 6 条直连 MySQL 主库做主键批量复核兜底。

* **追问：撤回资料时，能不能做成「先写 Redis 墓碑、再提交 MySQL 撤回事务」？顺序反过来会有什么问题？**

  > **答**：不能反过来，必须**先提交 MySQL 主库事务，事务成功后再写 Redis 墓碑**（万一写 Redis 失败由同库待投递事件记录在 1 秒内异步补写，期间还有最后一步 MySQL 主库主键复核兜底不会漏出废数据）。如果反过来在事务提交前先写了 `24 小时` Redis 墓碑，万一紧接着 MySQL 事务因为锁冲突或网络异常回滚了——数据库里这份资料明明还是合法的 `ACTIVE` 状态，Redis 里却立了一块 24 小时的墓碑把它死死拦在检索门外，造成长达一天的幽灵误封杀。

### 3.6 ZSet 排行榜、延迟队列与复合排序边界

#### 1. 核心定位与常考主线

ZSet 不只是「有序集合」名词，项目里真正要答清的是：`dict` 如何 O(1) 取分、跳表如何做范围与排名、同分如何确定性排序、排行榜如何分页与更新、延迟队列如何可靠取任务，以及 score 的 double 精度限制。它与 ZSET 租约的区别在于一个管排序，一个管带到期时间的执行资格。

#### 2. 底层机制与高频考点

* **排行榜的核心操作与复杂度**：

  1. **写入与更新**：`ZADD key score member` 插入或更新分数，`ZINCRBY key delta member` 原子累加；成员唯一，重复写不会重复计数。大对象底层 `dict + zskiplist`，小对象走 `listpack`。

  2. **排名与范围**：`ZSCORE` 取分，`ZRANK/ZREVRANK` 取正/倒排名，`ZRANGE/ZREVRANGE` 按排名区间，`ZRANGEBYSCORE` 按分数区间，`ZCOUNT` 统计区间成员数。跳表节点带前向跨度 `span`，范围遍历平均 `O(log N + M)`。

  3. **分页与去重**：`ZREVRANGE key start stop WITHSCORES` 做排行榜分页；更新后排名会变化，实时榜允许小幅漂移，若要求严格不重复不漏，应固定活动快照或按 `(score, member)` 做游标推进。

* **同分排序与 score 精度边界**：

  * ZSet 默认按 `(score, member 字典序)` 排序，同分不能再自定义比较器；要让「积分优先、同分早到优先」，必须把时间信息编码进 score 或把排序拆成两步。

  * score 是 IEEE 754 double，连续精确整数上限为 `2^53`，不能简单把两个任意 32 位整数拼成 64 位塞进去。工程上可用相对于活动起点的有界秒数差和放大系数，先验证 `points_max × B + seconds_max < 2^53`，并处理同分回退与字典序决胜；范围更大就拆字段或持久化到数据库排序。

* **延迟队列与到期任务**：

  * `member = taskId:leaseToken`、`score = executeAtMs`，调度线程用 `ZRANGEBYSCORE key -inf now LIMIT 0 N` 取到期任务；使用 Lua 原子完成「读取 → 标记处理中/移除」，避免多实例重复领取。

  * 处理失败重新 `ZADD` 时要带新代次与退避时间，不能让旧执行者无条件重插；租约场景还要先验 `ZSCORE > now` 再 `ZADD XX` 续期，防止僵尸令牌复活。

#### 3. 项目落地与系统设计权衡

NoteWeave 的 ZSET 租约以唯一 lease_token 做 member、到期毫秒做 score，解决的是执行资格与自动回收；若做研究热点或文档排行，则使用独立排行榜 key，避免把租约淘汰与业务积分混在同一结构里。制造业的 `next_run_at` 仍由 MySQL 权威保存，因为需要按优先级、状态与到期时间联合领单，不能只用 ZSet 的单一 score 表达复杂调度。

#### 4. 面试口述与连环追问

> **【面试口述】**ZSet 大对象是 dict 加跳表，dict 负责按成员取分，跳表负责范围与排名。排行榜更新用 ZINCRBY，分页用 ZREVRANGE，实时榜允许排名漂移，严格不重复要固定快照或按分数和 member 做游标。score 是 double，不能把两个 32 位整数直接拼成 64 位；同分按时间排要控制放大系数和时间范围并验算不超过 2^53。延迟队列取到期任务必须 Lua 原子领取并带代次，不能让旧执行者把已过期令牌重新塞回。

* **追问：排行榜中两个人积分相同，怎么保证先到的人排前面？**

  > **答**：ZSet 默认只会按 member 字典序打破同分，所以不能把业务规则交给默认排序。可以把活动开始后的时间差编码进 score，让早到者的排序分量更大，并先验算放大后的整数不超过 2^53；如果积分和时间范围都很大，就不要挤在一个 double 里，改成数据库 `(score, created_at, id)` 排序，或拆成两个排序字段后应用层稳定归并。

## 四、消息中间件与分布式任务调度深度考点（Kafka · RabbitMQ · Outbox · XXL-Job）

### 4.1 消息队列核心选型横评（为什么 NoteWeave 用 `Kafka` 而制造业用 `RabbitMQ`？）

| 对比维度 | `Apache Kafka`（[Kafka 4.1 Docs](https://kafka.apache.org/41/design/design/)） | `RabbitMQ 3.12+`（[Quorum Queues](https://www.rabbitmq.com/docs/quorum-queues)） | `RocketMQ`（[Transaction Msg](https://rocketmq.apache.org/docs/featureBehavior/04transactionmessage/)） | 
| ----- | ----- | ----- | ----- | 
| **核心存储与消费模型** | 分区追加日志（Partition + Segment），消费只推组 `offset` 不删日志，天然支持多消费组独立订阅与按位点历史回放 | AMQP `Exchange -> Binding -> Queue` 灵活路由扇出，消息确认消费后即从队列移除（Streams 类型除外） | 单机共享 `CommitLog` 顺序写 + 轻量 `ConsumeQueue` 逻辑索引，支撑万级业务 Topic 不退化随机写 | 
| **高可用与复制语义** | 分区 Leader/Follower，`ISR` 动态同步集 + `acks=all` + `min.insync.replicas`，控制面 `KRaft` Raft 多数派替代 ZooKeeper | **Quorum 仲裁队列**基于 Raft 协议（3 节点至少 `2/3` 多数派写 WAL 落盘回 Confirm，替代易脑裂经典镜像队列） | 主从同步/异步复制或 DLedger Raft 选主 | 
| **事务与延迟队列能力** | Kafka 事务仅闭环「读 Kafka → 算 → 写 Kafka + 提交位点」，不包外部 MySQL；普通 Topic 无逐条任意延时可见 | 无跨库事务（制造业配同库 `Outbox`）；原生 `TTL+DLX` 有队头长延时阻塞短延时缺陷，3.12 仲裁队列无消息优先级 | 原生两阶段半消息（Half Message）+ Broker 定时回查本地事务表；4.x 支持 18 级延迟、5.x 时间轮支持任意定时 | 
| **简历双项目选型落点** | **NoteWeave 选择**：128 MB 文件四阶段解耦需阶段失败独立重放、向量化 6 分区高吞吐并行、摘要按会话分区保序、长产物靠 `pause/resume` 留磁盘背压 | **制造业选择**：日均告警 `<1,000` 条但需毫秒级 `topic` 路由扇出给通知与车间看板、逐条 `Manual ACK` 与超限进死信 `DLX`，动态优先级与延期收归 MySQL | 面试对比备选：若不用同库 `Outbox`，也可换 RocketMQ 半消息实现本地落库与发消息最终一致，但仍省不掉下游网关幂等与对账 | 

* **追问：如果制造业项目把同库 `Outbox + RabbitMQ` 换成 `RocketMQ` 事务消息（Half Message），是不是就不需要你那套通知表和对账状态机了？**

  > **答**：换 RocketMQ 半消息加本地事务回查，只能替代『第二层 `Outbox` 表到 Broker 发布原子性』这一小段，省不掉后面的 `notify_task` 调度表和网关对账闭环。因为通知系统真正的硬骨头在后半程：一是外部运营商网关发生读超时必须挂起延后 `30 秒` 拿冻结单号对账，二是两分钟 3,000 条补报洪峰下要按动态优先级加 `10 秒` 分段老化在库里重排调度，三是早晚八点交接班要按主键升序批量取消上一班未发出的待办单——消息一旦发进任何 MQ 队列就很难按业务条件批量取消或动态改优先级了，所以调度主权依然得留在 MySQL。

### 4.2 `Kafka` 高性能原理、副本水位（`LEO/HW/LSO`）、可靠性与长任务背压（结合 NoteWeave）

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 3/4/5 三处重度使用 Kafka：「**摘要经 Kafka 异步生成**」「**将解析、切片、向量化和索引拆为 Kafka 分阶段任务并按处理版本幂等推进**」「**结合 Kafka 分区并行消费与工作台级并发准入调度独立任务**」。

#### 2. 底层机制与高频考点

* **Kafka 为什么基于磁盘还能达到极高吞吐？（五大支柱 + 边界）**：

  1. **分区日志顺序追加写**：Partition 拆为多个 `Segment`（`.log` 数据文件 + `.index` **稀疏逻辑 offset 索引** + `.timeindex` 时间索引，通过二分定位最近稀疏锚点再顺序扫少量字节，省内存且免随机寻道）。

  2. **重度利用操作系统 `Page Cache`**：Broker 自身 JVM Heap 不必设太大（留足机器内存给 OS 页缓存），生产写入页缓存后紧跟的实时消费者可直接从页缓存命中读取，省去物理读盘。

  3. **`sendfile` 零拷贝（Zero-Copy）**：传统读文件发网络需经历「磁盘 → 内核 Page Cache → 用户态缓冲区 → 内核 Socket 缓冲区 → 网卡」4 次拷贝与 4 次上下文切换；Linux [`sendfile(2)`](https://man7.org/linux/man-pages/man2/sendfile.2.html) 配支持 Scatter-Gather DMA 的网卡，直接在内核态把 Page Cache 描述符交给网卡发送，省去用户态往返与 CPU 拷贝（**必答边界**：开启 SSL/TLS 加密时因需在用户态做加解密变换，无法走裸 `sendfile` 零拷贝路径）。

  4. **端到端批处理与批量压缩**：Producer 按分区在 `RecordAccumulator` 攒批（`batch.size` + `linger.ms=5`）并整批 `lz4 / zstd` 压缩，Broker 原样落盘，Consumer 拉回才解压。

  5. **Claim Check 传指针卸大载荷**：大 PDF 原件、解析正文与向量块一律存 MinIO，Kafka 消息体仅传几百字节的 `(docId, proc_version, minio_ref)`，防爆 `max.message.bytes` 与复制带宽。

* **副本复制、三道水位边界（`LEO / HW / LSO`）与端到端防丢**：

  * **`LEO`（Log End Offset）**：某副本本地日志末尾的**下一条**待写位置；**`HW`（High Watermark）**：已满足复制提交条件的可见边界（普通 `read_uncommitted` 消费者最多读到 `< HW`）；**`LSO`（Last Stable Offset）**：开启事务隔离 `isolation.level=read_committed` 时的可见边界，取 **`min(HW, 最早未决事务起始 offset)`**（故若磁盘已有 offset 100 的消息，但 offset 98 挂着一笔未提交事务，`read_committed` 消费者就会被卡在 98 之前读不到 100）。

  * **为什么 `acks=all` + `min.insync.replicas=2`（`RF=3`）不是 Raft 任意多数派？** `acks=all` 等待的是**当前 `ISR`（In-Sync Replicas）集合内所有副本**复制确认，而 `min.insync.replicas=2` 是允许成功写入的最低同步副本门槛（若 3 副本都在 ISR 需等 3 份；挂 1 台剩 2 台在 ISR 等 2 份；挂 2 台只剩 Leader 1 台低于门槛则直接拒写保安全，配合 `unclean.leader.election.enable=false` 严禁落后非安全副本选主丢数据）。注意 `acks=all` 确认的是写入各副本内存/页缓存，不代表每条都同步执行了物理 `fsync`。

  * **幂等生产者边界**：`enable.idempotence=true`（要求 `acks=all` 且 `max.in.flight.requests.per.connection <= 5`）靠 Broker 校验 **`(PID, Epoch, Partition Sequence Number)`**，既消除了单连接多在途批次重试乱序，又拦截了网络超时自动重传导致的 Broker 重复追加；但它**管不了应用重启换新 PID 或业务层重新调 `send()`**，下游消费端必须保留业务唯一键或外部版本号幂等（如 ES `version_type=external_gte`）。

* **重平衡（Rebalance）、位点安全提交与长任务背压（NoteWeave 核心亮点）**：

  * **两个完全不同的超时参数**：`session.timeout.ms` 靠独立后台心跳线程维持，检测容器死机失联；**`max.poll.interval.ms`（默认 `300s`）检测业务拉取线程两次调用 `poll()` 的间隔**——哪怕后台心跳正常，只要单批消息处理超过 300s 没调下一次 `poll()`，协调器就会判定活锁将其踢出消费组触发重平衡（Kafka 4.x 支持 `CooperativeStickyAssignor` 增量撤销或新 `group.protocol=consumer` 服务端协调减少全组停顿，但被踢分区仍会被重派导致双写）。

  * **NoteWeave 分钟级产物队列五步闭环**：

    1. **单拉拆池**：产物任务耗时 2～6 分钟，消费端单独设 **`max.poll.records = 1`**（区别于向量化快阶段的 `10`），拉取线程不跑模型，直接转交 `8` 线程零队列 `SynchronousQueue` 执行池。

    2. **动态 `pause / resume` 背压**：8 线程一满，拉取线程立即调 `consumer.pause(assignedPartitions)` 暂停取新消息，但外层循环照常高频空 `poll(100ms)` 续命心跳与重平衡回调，空出线程再 `resume()`。

    3. **满工作区 4 槽转数据库延迟态避免队头阻塞**：若某工作区连发 10 单占满 ZSET 4 槽，第 5 单不阻塞整个分区后面其他工作区的任务，而是条件更新落库为 `DELAYED` 态视为本轮消息已接纳处理。

    4. **连续完成前缀位点提交（严禁跳提交）**：关闭自动提交（`enable.auto.commit=false`），分区内维护在途集合——若 offset 100 还在线程池跑，offset 101 因满槽快速转了 `DELAYED`，**绝不能提交 102**（否则此时崩溃重启从 102 读，100 就丢了），只推进**前面所有记录均已完成或落妥延迟态的连续前缀下一位置**；在途任务每 60s 续槽位租约同步刷库表租约，写页与写终态均校验执行代次令牌防双写。

    5. **完单前「先 Lua 续租、再 DB 认领」原地接力（Relay）**：工作线程跑完一单准备释放槽位前，若同工作区有 `DELAYED` 积压单，先调 Redis Lua（验 `ZSCORE > now` 并 `ZADD XX`）续期工作区租约，再通过数据库条件更新原子认领最早 1 单接力跑（影响 0 行立即 `ZREM` 释槽，**最多连跑 1 次**即主动让出槽位防饿死其他工作区），免去消息绕回 Kafka 或二次争抢 `SynchronousQueue`。

* **消息积压排空公式**：当消费完成率 `μ` > 上游到达率 `λ` 时，排空存量积压 `B` 所需时间 `T ≈ B / (μ - λ)`。普通消费组同组最大分区并行度受限于**分区数**（新建另一个消费组只会从头独立再算一遍，不能帮旧组分担积压；扩分区也不会自动搬走旧分区已积压的存量消息，且会改变 `session_id` 哈希映射打乱同会话增量摘要顺序，故摘要 Topic 积压优先提速单条模型吞吐，低峰期才受控扩分区）。

#### 3. 面试口述与连环追问

> **【面试口述】**在 NoteWeave 里我用 Kafka 跑了两类特征不同的任务。第一类是 128 MB 资料的四阶段流水线和会话增量摘要：大文件拆成解析、切片、6 分区并行向量化（按 `docId+batchNo` 打散，通过批次明细表条件更新汇聚）和 `external_gte` 外部版本写 ES，原件放 MinIO 消息只传指针。会话摘要则以 `session_id` 作分区键固定进同一分区串行保序。第二类是两到六分钟的重型产物生成：如果用默认配置一次拉一批在拉取线程跑，很容易超 `max.poll.interval.ms` 300 秒被踢出组触发重平衡。所以我单独设 `max.poll.records=1` 拆给 8 线程 `SynchronousQueue` 执行池，满池调 `pause()` 停拉但保持空 `poll` 续心跳。遇到单工作区满 4 槽就转数据库 `DELAYED` 态放行后序工作区，但位点提交严格只推『连续已完成前缀』不越过在途任务，并且线程完单释槽前先调 Lua 续租再原子认领 1 单同工作区延迟任务原地接力，在并发长任务压测窗口内没有观测到超时重平衡或单工作区满槽造成的队头阻塞。

* **追问：假如线上监控告警 NoteWeave 的「会话增量摘要 Topic」突然积压了上万条消息，能不能立刻在线把分区数从 3 个扩到 12 个来加速排空？**

  > **答**：不能盲目直接扩分区，这里有两个硬坑。第一，扩分区并不会把旧的 `0、1、2` 三个分区里已经积压的那上万条存量消息搬到新分区去，存量积压依然只能由原来那 3 个消费者慢慢啃。第二，会话增量摘要是靠 `murmur2(session_id) % numPartitions` 把同一个会话固定路由到同一分区保序的，一旦在线把模数改成 12，同一个活跃会话新产生的消息就会哈希到新分区被先算出来，而旧分区里更早的消息还在排队，直接造成摘要版本乱序反转。正确止血姿势是先优化或扩容下游模型推理并发把单分区消费耗时降下来，若确需长期扩分区，必须在低峰期等旧分区积压排空后再统一变更。

### 4.3 `RabbitMQ` 仲裁队列、双连接隔离、`Outbox` 与 `稳定请求号对账`（结合制造业平台）

#### 1. 核心定位与常考主线

简历在制造业职责 1 写到：**「针对任务落库与 MQ 发布不一致及重复投递问题，采用 Outbox + 发布确认实现可恢复发布，结合消费确认、稳定请求号对账与业务幂等防重」**。这是后端面试考察跨故障域最终一致性的标准模板。

#### 2. 底层机制与全断点恢复闭环

* **为什么选本地消息表 `Outbox` 而不直接发 MQ 或上分布式事务？**

  * **事务内发 MQ**：网络抖动拖成秒级长事务耗尽 HikariCP 连接，且后续本地回滚撤不回已发出的消息。

  * **事务提交后直发 MQ**：提交完瞬间进程崩溃或断网，消息永久丢失。

  * **`XA / Seata AT / TCC`**：强阻塞或业务侵入重，且外部运营商短信网关与第三方 CMMS 无法接入内部事务协调器。

  * **同库 `Outbox` 闭环**：业务表（`anomaly_round`、`notify_task`，若是 P0 首报同事务一并预埋一张 `+60s` 独立语音兜底单）与 `outbox` 表在**同一个 MySQL 毫秒级本地事务**中原子提交；注册 Spring `TransactionSynchronization.afterCommit` 钩子异步快路径投递 RabbitMQ，漏发或断网未确认记录由每机 `1s` 守护线程（扫超 `2s` 宽限期记录，`RC + SKIP LOCKED` 认领 `5s` 短租约递增 `corr_ver`，指数退避）重投兜底。

* **RabbitMQ 三端防丢与生产级「双物理 TCP 连接隔离」**：

  1. **生产端双确认**：开启 `publisher-confirm-type: correlated`（带 `outbox_id + corr_ver`）确认到达 Exchange/Queue，**同时开启 `mandatory: true` + `ReturnsCallback`** 拦截 Exchange 存在但路由键无匹配队列导致的静默丢弃；只有收到 `Confirm ACK` 且未触发 `Return` 才将 `Outbox` 条件更新为 `PUBLISHED`（若队列设 `x-max-length` 必配 `overflow=reject-publish`，防默认 `drop-head` 静默删队头老消息却仍回 ACK）。

  2. **Broker 端 Raft 仲裁队列（Quorum Queue）**：持久化 `topic` 交换机绑定 3 节点 **Quorum 仲裁队列**，1 Leader + 2 Follower 基于 Raft 协议至少 **`2/3` 多数派写入磁盘 WAL** 才向生产者回 Confirm ACK，解决旧版经典镜像队列同步阻塞与网络分区脑裂丢消息问题。

  3. **消费端限流与手动确认**：`AcknowledgeMode.MANUAL` + `prefetch=20`（限制未确认在途消息数防撑爆消费端内存）+ `x-delivery-limit=5` 超限自动路由进死信交换机 `DLX / DLQ` 告警。

  4. **关键工程细节：发布与消费拆两个独立 `ConnectionFactory`（双 TCP 连接）**：RabbitMQ 任一节点内存超 `vm_memory_high_watermark`（默认 `0.4`）或磁盘低于阈值触发流控告警时，Broker 会按 **TCP `Connection` 粒度**暂停读取所有**曾发过 Publish 帧**的连接，而纯 Consume 连接不受阻。若应用读写共用默认单 `Connection`（多 `Channel` 复用），Broker 内存满了想靠消费者消费消息发回 `ACK` 腾内存，结果连消费端发 `ACK` 的 TCP 通道也被一起冻死，形成**集群级连坐死锁**。物理拆开生产与消费两个 `ConnectionFactory` 即可破局。

* **为什么断网 `90s` 恢复重放 `310` 条 `Outbox` 事件不会重复发短信？（四层状态物理拆表）**：

  * 系统将①异常轮次处置状态、②`Outbox` 发布状态、③`notify_task` 通知任务调度状态、④网关回执状态拆在四张独立表。断连 RabbitMQ 90s 期间，本机 `1s` 守护线程早已直接扫第三层 `notify_task` 表把紧急短信发完了；恢复后补发的 `310` 条第二层事件一侧帮车间大屏看板凭轮次版本号高水位补齐画面，另一侧通知消费者收到后**仅置内存唤醒标志即 `ACK`**，守护线程探活见第三层已无 `PENDING` 到期单直接休眠，不会重复发短信。

* **高频补充：雪花算法（Snowflake）64 位结构与时钟回拨防护**：

  * 64 位 `long` 构成：**`1` 位符号位（恒 0）+ `41` 位毫秒时间戳（约 69 年）+ `10` 位机器/机房 ID（最多 1024 节点）+ `12` 位毫秒内自增序列（单节点每毫秒 4096 个）**，趋势递增适合做 MySQL 聚簇索引或唯一请求号 `request_no`。

  * **时钟回拨处理**：回拨极小（如 `≤ 5ms`）自旋等待追平；回拨较大则切换备用 `workerId` 或引入扩展序列号位报警，避免生成重复单号击穿幂等校验。

* **外部网关超时未知：`稳定请求号对账` 与慢 GC `200 OK` 不对称收敛**：

  * 关闭 HttpClient 隐式自动重试；首次领单短事务生成雪花算法 `request_no` 冻结不变。

  * **慢 GC 租约过期后的不对称写回**：若发送线程调网关途中遇超过 `8s` 租约的慢 GC，存活实例已递增 `exec_gen` 将任务收回转 `待对账（RECONCILING）`。原线程醒来分两路：① 若手里是超时/网络异常，因 `WHERE status='SENDING' AND exec_gen=?` 失配影响 `0` 行直接安全放弃；② **若原线程已拿到网关明确返回的 `200 OK` 与渠道流水号，则在同短事务按唯一 `request_no` 幂等插入回执表留证，并允许直接按 `WHERE request_no=? AND status IN ('PENDING','SENDING','RECONCILING')` 将主任务一步收敛为 `已受理（ACCEPTED）`**，省去盲等 30 秒。

  * **真正读超时结果未知**：转 `待对账` **延后 `30 秒`**（避开运营商网关内部异步落账延迟，立刻查会查不到误判重发）持原 `request_no` 调回查接口，已受理则补终态，确认未收到才持**原 `request_no`** 重投。5,200 条故障注入演练（4,890 实时 + 310 断网补发；5,150 一次受理 + 12 强杀接管 + 38 超时对账）两本账对齐，未观测到重复受理。

#### 3. 面试口述与连环追问

> **【面试口述】**在制造业项目里，通知横跨 MySQL、RabbitMQ 和外部短信网关三个故障域，我用『四层拆表 + 同库 Outbox + 原号对账』做成了全断点可恢复闭环。落库时把异常轮次、通知任务（P0 首报同事务预埋 `+60s` 语音兜底单）和 `Outbox` 放同一本地事务提交，`afterCommit` 快路径投 RabbitMQ 3 节点 Raft 仲裁队列，开启 `correlated` 发布确认和 `mandatory` 退回回调，并专门把生产和消费拆成两个独立的 TCP `ConnectionFactory`，防止 Broker 触发内存高水位阻塞发布连接时连坐锁死消费端的 `ACK`。对外部不可撤回的短信网关，我关掉客户端自动重试，首次领单绑死雪花 `request_no`：遇到 3 秒读超时转待对账延后 `30 秒` 等运营商落账后持原单号回查。万一线程遇慢 GC 超 `8 秒` 租约被接管，醒来若是异常就因 `exec_gen` 失配放弃，若已拿到明确 `200 OK` 凭据就写回执表并按 `request_no` 直接收敛主单。演练 5,200 条全部最终发布，强杀中断平均 `8.9 秒`、最慢 `9.6 秒` 内被接管，未观测到重复业务通知。

* **追问：调用外部短信网关报 `SocketTimeoutException` 读超时的时候，为什么不立刻调回查接口，或者换个新流水号立刻重试，非要延后 `30 秒` 拿原 `request_no` 查？**

  > **答**：这是由外部网关的内部异步架构决定的。读超时发生在 TCP 响应回程未知的灰色地带——网关很可能已经收下请求放进了内部缓冲队列，只是还没落完回执库或回包丢了。如果一超时就立刻生成新 `request_no` 重发，在网关眼里就是两笔彼此独立的合法请求，车间班组长手机立马收到两条重复报警。而如果第 0 秒立刻拿原单号去调回查接口，网关自己的异步落账可能还差几百毫秒没写进查询库，会返回『查无此单』骗你重发。所以留出 `30 秒` 落账静默窗口再持冻结的原 `request_no` 对账（且 P0 首报早在 `T+0` 就独立预埋了第 `60 秒` 语音兜底单，不会耽误紧急停机救火），是兼顾防重与时效的最稳工程解。

### 4.4 `XXL-Job` 分布式调度、`优先级 + 老化调度` 与 `持久化延期`

#### 1. 核心定位与常考主线

简历实习经历技术栈列有 **`XXL-Job`**，职责 2 写到：**「MQ 与扫描入口统一按优先级 + 老化调度，结合持久化延期分批消化积压」**。面试必问：既然有了 RabbitMQ 和本机守护线程，为什么还要用 `XXL-Job`？`XXL-Job` 底层怎么防集群重复触发、时间轮怎么转？为什么不用 RabbitMQ 优先级队列或延迟插件？

#### 2. 底层机制与三级触发体系权衡

* **`XXL-Job` 核心底层机制**：

  1. **集群防重悲观锁**：多个 Admin 调度中心实例通过数据库表 `SELECT * FROM xxl_job_lock WHERE lock_name = 'schedule_lock' FOR UPDATE` 争抢排他行锁，同一时刻仅一个节点执行预读扫描，防止多 Admin 重复下发。

  2. **`5s` 预读 + `60` 槽秒级内存时间轮**：`ScheduleThread` 每次预读未来 **`5000ms`（`PRE_READ_MS`）** 内即将触发的任务：已过期的按过期策略处理，即将到期的按触发秒数 `triggerTime / 1000 % 60` 推入内存 `ConcurrentHashMap<Integer, List<Integer>>` **60 槽时间轮**，由独立 `RingThread` 按秒刻度精准摘槽投快/慢触发线程池 RPC 调执行器，把数据库锁竞争与精确触发时刻解耦。

  3. **路由与阻塞策略**：跨班升级采用 **`SHARDING_BROADCAST`（分片广播）**，双实例分别拿到 `shardIndex = 0, 1` 与 `shardTotal = 2`，在 SQL 中按 `MOD(factory_id, shardTotal) = shardIndex` 水平分工扫不同厂区；阻塞处理策略配 **`SERIAL_EXECUTION`（单机串行）** 配合数据库条件更新幂等。

* **制造业三级时间触发职责严格划分（绝不混用）**：

  1. **毫秒级实时一对多扇出 → `RabbitMQ`**：新告警同时唤醒通知模块与车间看板。

  2. **秒级高可靠状态推进与防饥饿老化 → 应用内本机 `ScheduledExecutorService` 守护线程**：

     * 为什么不把 `8s` 租约回收和到期催办交给 `XXL-Job`？因为 `XXL-Job` Admin 是中心化外部依赖且 RPC 有开销，一旦调度中心抖动或网络隔离，紧急告警接管不能停；本机 `scheduleWithFixedDelay(1s)`（上一轮跑完再等 1s，防任务超时堆积）直连数据库最稳。

     * **`10s` 分段老化与封顶 `P1` 设计**：两分钟涌入 `3,000` 条 `P3` 断网补报单时，取消 MQ 消费者直调网关（RabbitMQ 3.12 仲裁队列不支持消息优先级，且就算经典优先级队列，已被 `prefetch` 预取到客户端内存的消息也无法被后来的 `P0` 插队；拿不到令牌发 `nack requeue` 还会在 Broker 与客户端之间死循环空转耗光 CPU）。统一收归数据库按 `(status, priority, next_run_at)` 领单，拿不到令牌就用 Lua 返回的等待毫秒加**随机微抖动（防下一秒集体惊群抢桶）**推迟 `next_run_at` 落库做**持久化延期**；同时本机另一守护线程**每 `10 秒`**沿 `(status, next_aging_at)` 索引 `RC + SKIP LOCKED` 取出最多 `200` 个等待满 `10 分钟` 且低于 `P1` 的主键，按**聚簇主键升序**批量提一档优先级——**严格封顶 `P1` 不升 `P0`**，既保证低优补报几十分钟内有序排空不饿死，又永远给最新爆发的真实 `P0` 停机告警留出最高优先超车道。

  3. **班次边界与全局重批处理 → `XXL-Job`（仅管 4 件事）**：① 早晚 **`08:00 / 20:00` 跨班交接升级**（为什么跨班升级不用 MQ 延迟消息？因为延迟消息发出去就定死了，车间一旦临时调整排班表无法在队列里批量改期或取消，且需在八点整对所有未物理关轮的故障统一结算取消上班遗留单、生成接班员 `SHIFT_ESCALATE` 单并给未关 P0 重新预埋新班次 `+60s` 语音单）；② 夜间通道账单全量对账核销；③ 凌晨 `7 天` 前历史冷单归档；④ 凌晨工业知识库新批次构建发布。

#### 3. 面试口述与连环追问

> **【面试口述】**我在系统设计上把时间触发按特征切成了三层：毫秒级事件扇出走 RabbitMQ。秒级到期领单、`8 秒` 租约回收和每 `10 秒` 一次的低优分段老化放在每台实例本地的 `ScheduledExecutorService` 固定延迟守护线程里，这样哪怕 MQ 和调度中心全挂了，核心告警照样能发能接管。而 `XXL-Job` 专门负责早晚八点跨班升级、夜间账单对账、凌晨冷单归档和知识批次发布这四类全局批处理。底层上 `XXL-Job` 靠数据库 `schedule_lock` 排他行锁防多中心重复触发，预读未来 `5 秒` 任务推入 `60` 槽秒级内存时间轮保精度，跨班升级用分片广播按厂区取模并行处理。至于两分钟 3,000 条补报洪峰，因为 RabbitMQ 3.12 仲裁队列不支持优先级、且预取到本地的消息无法被新 `P0` 插队，所以我把调度权收归数据库：无令牌时加随机抖动推迟 `next_run_at` 做持久化延期不空转，守护线程每 10 秒用 `SKIP LOCKED` 按主键升序把等满 10 分钟的低优单提一档、但严格封顶到 `P1`，既不饿死低优单，又把最高优先超车道留给刚发生的 `P0` 停机事故。

* **追问：早晚八点交接班升级为什么用 `XXL-Job` 扫表，而不用发消息时直接算好距离八点还剩多少秒投进延迟队列？**

  > **答**：因为车间现场有两类高频动态变更，静态延迟消息根本招架不住。第一是早八点之前大多数告警已经被夜班师傅现场确认或修好复机了，用数据库扫表只需对仍在持续的异常做交接，如果每条告警一产生就往延迟队列塞消息，八点整会产生大量无效唤醒再去查库丢弃。第二是车间经常因为赶订单临时调整排班表或换人顶岗，消息一旦躺在 MQ 延迟队列里既改不了触发时刻也改不了接收人，而在 MySQL 里由 `XXL-Job` 分片广播按当刻最新排班表按主键升序结算旧单、生成新班次升级单并为未关 P0 补埋新语音单，业务一致性要干净得多。

## 五、检索引擎与 Hybrid RAG 深度考点（Elasticsearch · BM25 · HNSW · RRF · Rerank · QA/Note/Wiki）

### 5.1 `Elasticsearch` 底层倒排原理、近实时（NRT）链路与外部版本幂等

#### 1. 核心定位与常考主线

简历在 NoteWeave 技术栈与职责 2/4 深度使用了 `Elasticsearch`：18 万切片混合检索、定制分析器、批量 `bulk` 建索引，以及最核心的考题——**「为什么资料在 MySQL 已经删了，ES 里还能被搜出来？为什么不能每次删资料都直接调 `refresh=true` 强刷？」**

#### 2. 底层机制与高频考点

* **Lucene 倒排索引三大核心结构（为什么上亿文档毫秒级检索且不撑爆内存？）**：

  1. **`Posting List`（倒排表）**：记录包含某词项的所有文档 ID 列表及词频、偏移位置。对递增整数 ID 采用 **Frame of Reference（FOR）差值分块压缩**省磁盘；多条件布尔过滤（`filter`）在内存合并时自动转为 **`Roaring Bitmap`（咆哮位图：高 16 位分桶，稀疏桶用有序 `short[]` 数组、稠密桶用 `65536 bit` 位图、连续桶用游程编码 RLE）** 做极速位运算求交。

  2. **`Term Dictionary`（词典）与 `Term Index`（词典索引 `FST`）**：排序后的全量词典太大放磁盘，内存中只驻留基于 **`FST`（Finite State Transducer，有限状态转换器）** 构建的前缀+后缀双重共享有向无环图索引，体积压至原词典的几十分之一，定位磁盘词典块后再顺序读倒排表。

  3. **`Doc Values`（列式正排存储）**：倒排解决「由词找文档」，而排序、分组聚合或脚本过滤需要「由文档找字段值」，Lucene 在建索引时同步生成磁盘列式存储 `Doc Values` 交 OS Page Cache 缓存。

* **ES 写入、近实时可见与软删除回收全链路（撤回滞后的根本原因）**：

  1. **`Index`（内存缓冲 + `translog`）**：文档写入先进入内存 `Indexing Buffer`（此时**不可被搜索**），同时追加写 `translog` 保障崩溃可恢复。

  2. **`Refresh`（默认每 `1s` 一次 → 近实时可见）**：每隔 `1s` 将内存缓冲生成一个新的**不可变 Lucene 段（Immutable Segment）** 写入操作系统 Page Cache 并打开供搜索，清空内存缓冲。**为什么不能每次删改都传 `?refresh=true`？** 高并发下每次请求强刷会产生海量几 KB 的微型碎段，耗尽文件句柄并触发后台疯狂段合并打满磁盘 IO，且跨 MySQL 与 ES 同步双写遇到异常无法回滚。

  3. **`Flush`（刷盘切 `translog`）**：定期或 `translog` 满阈值时执行 `fsync` 将 Page Cache 中的段刷入物理磁盘、写入 commit point 并截断旧 `translog`。

  4. **删除与更新本质（`.del / .liv` 位图 + `60s` 回收窗口）**：因为 Lucene 段不可变，执行 `delete_by_query` 并不会立刻去磁盘抹掉文档字节，而是在段旁边的 **`.liv`（Live Docs）位图**中将该文档标记为已删除，且默认保留 **`index.gc_deletes = 60s`** 供在途搜索快照与历史版本校验，直到后台 **`Merge`（段合并）** 把多个小段合并成大段时才真正物理剔除废文档。这正是 NoteWeave 在 `delete_by_query` 确认 `failures` 为空后，仍让 Redis 墓碑保留 **`60s`** 的底层依据。

* **NoteWeave 工程实践三大细节**：

  * **索引别名零停机重建**：业务代码永远只读写工作区逻辑别名（Alias）；当需要修改分词器或字段 Mapping 时，后台新建 `idx_v2` 重灌数据，再用原子 `_aliases` API 一键切走旧 `idx_v1`，线上零停机。

  * **`bulk` 批量与外部版本号 `external_gte` 幂等**：建索引每批 `500` 条或 `5MB`（过大易引发协调节点内存抖动），写入显式带 `version = proc_version` 且 `version_type = external_gte`——既允许同版本 Kafka 重试批次幂等覆盖，又在引擎层直接拒绝迟到的旧版本慢任务覆盖新切片。

  * **深分页对比**：ES 默认拒查 `from + size > 10,000`（协调节点需向每个分片拉取 `from+size` 条做全局归并排序，复杂度成倍放大）；`scroll` 会冻结历史快照耗内存仅适离线导出；在线深翻页统一用 **`search_after + PIT（Point in Time）`** 轻量级一致性视图配唯一排序键游标推进。

#### 3. 面试口述与连环追问

> **【面试口述】**Elasticsearch 底层基于不可变的 Lucene 段：词典索引靠 `FST` 前后缀共享把内存压到极小，倒排表靠差值压缩和 `Roaring Bitmap` 咆哮位图做极速布尔求交。写入时文档先进内存缓冲和 `translog`，默认每 `1 秒` `refresh` 生成新段进操作系统页缓存才可被搜到。而删除文档只是在 `.liv` 位图打删除标记，默认还有 `index.gc_deletes=60s` 的保留窗口，直到后台段合并才物理清掉。如果删资料时同步强调 `refresh=true`，不仅跨库没法回滚，还会刷出大量微型碎段把磁盘 IO 打爆。所以我才设计了先写 24 小时 Redis 墓碑拦截、等后台 `delete_by_query` 确认 `failures` 为空后再把墓碑缩期到 `60 秒` 覆盖刷段窗口的异步闭环，写新版本时再配 `version_type=external_gte` 拒绝迟到旧写。

* **追问：ES 写入时用的是 `version_type=external_gte` 而不是普通的乐观锁 `if_seq_no`，这两者有什么区别？为什么选 `external_gte`？**

  > **答**：ES 内部原生的 `_seq_no + _primary_term` 是引擎自己维护的分片级写入序号，适合『先从 ES 读出来改完再写回去』的内部并发更新，但感知不到上游 MySQL 权威资料到底升到了第几版。在我们的 Kafka 异步索引流水线里，真正权威的版本号是 MySQL 文档主表单调递增的 `proc_version`：万一第 3 版的 Kafka 批次因为分区重试迟到了，而第 4 版已经写进了 ES，用 `external_gte` 直接把 `proc_version` 作为外部版本号传给 ES，ES 引擎层看到 `3 < 4` 会直接返回版本冲突拦截旧覆盖，看到同为 `4 == 4` 的重试批次则幂等放行覆盖，天然对齐上游数据库版本。

### 5.2 `Hybrid RAG` 漏斗工程：`BM25 / BM25F` + `HNSW` 向量 + `RRF 融合` + `Rerank`

#### 1. 核心定位与常考主线

简历两段项目均以 `Hybrid RAG` 为核心亮点：NoteWeave 用 **「`BM25 + Vector` 双路召回、`RRF 融合`与 `Rerank`」**（单轮 `Recall@10` 从 `0.66` 提至 `0.87`，`MRR` 从 `0.51` 提至 `0.78`），制造业用 **「故障编码、全文与向量三路召回、`RRF 融合`与重排」**（防穿越 `Hit@6` 达 `85%`）。面试必考每一层的算法数学直觉与参数定法。

#### 2. 底层机制与算法权衡

* **为什么纯稠密向量不够，必须上混合检索？**

  * 稠密向量模型（`bge-m3` 1024 维双塔 **Bi-Encoder**）把整段文本压缩进固定维度连续向量，擅长抓「主轴转起来发烫异响 ≈ 电主轴温升异常振动」这类**跨措辞语义泛化**，但有致命**信息瓶颈**：极易混淆仅差一位数字的工业报警码（`E2041` vs `E2014`）、错误码（`ERR_4031`）、精确软件版本号或生僻专有名词。

  * **NoteWeave 定制分词 `BM25`**：英文与符号配 `word_delimiter_graph`（索引端加 `flatten_graph`）将 `ERR_4031` 拆为 `ERR`、`4031` 并保留原词，中文用 `cjk_bigram` 二元切词（NoteWeave 单轮专有名词题 `Recall@10` 直接从纯向量的 `0.48` 飙升至 `0.93`）；制造业则扩展为 **故障码 `GIN` 数组精确路 + `zhparser` 工业词典全文路 + 向量路** 三路互补。

  * **`BM25` 打分三要素与 `BM25F`**：相比传统 TF-IDF 词频无限线性增长，BM25 引入 ① **词频饱和度参数** `k1`（默认 `1.2`，词重复出现多次后收益递减收敛上界）、② **文档长度归一化** `b`（默认 `0.75`，惩罚啰嗦长文档偶然撞词）、③ **逆文档频率 `IDF`**（越稀有的专有词权重越高）。NoteWeave Wiki 检索采用的 **`BM25F`** 则进一步对「页面标题、摘要、正文」赋予递减字段权重（标题命中远重于正文顺带提及）。

* **`HNSW`（Hierarchical Navigable Small World）分层小世界图参数调优**：

  * **检索过程**：借鉴跳表思想构建多层近邻图，顶层极其稀疏做大步跳跃导航，逐层贪心向距离 Query 向量最近的邻居收敛，到底层第 0 层做精细近邻搜索。

  * **NoteWeave 三个核心参数**：`m = 16`（每个节点双向连接的最大邻居数，越大召回越高但内存与建图开销线性涨）、`ef_construction = 100`（建图插入节点时动态维护的候选列表大小，决定图拓扑质量）、查询期 `k = 50, num_candidates = 100`（每个分片搜索时保留的动态候选池，取 `2×k` 兼顾召回与延迟）。带墓碑过滤时必须把 `must_not` 塞进 **`knn.filter` 走图遍历期预过滤（Pre-filtering）**，边走图边跳过废节点凑够 50 个有效近邻，否则后过滤会被废切片占空名额。

* **`RRF`（Reciprocal Rank Fusion，倒数秩融合）公式与为什么不用分数加权？**

  * **标准公式**：

    ```formula
RRF_Score(d) = Σ [ 1 / (k + rank_r(d)) ]   （r ∈ 各召回路，k = 60）
```java

    其中 `R` 为各召回路，`rank_r(d)` 为文档 `d` 在第 `r` 路中的正整数名次（从 1 开始），平滑常数取业界验证稳健值 **`k = 60`**（抑制单路排第 1 的极端孤证霸榜，奖励在多路均排前列的高共识候选）。

  * **为什么不用线性加权 `α·BM25 + (1-α)·Cosine` 或 Min-Max 归一化？** 因为 **分数量纲与分布形态完全异构**：`BM25` 分数区间为 `[0, +∞)` 无上界，一旦撞上罕见高 IDF 词某条分数可能飙到 30 多分，做 Min-Max 会把其余正常的 8 分、9 分全部压扁到 0.2 以下；而 `bge-m3` 余弦相似度往往挤在 `[0.65, 0.85]` 极窄区间。`RRF` **只看序数名次不看绝对分值**，免调参、对异常离群高分免疫（代码实现时按切片 ID 去重累加各路贡献）。

* **`Rerank` 交叉编码器（`Cross-Encoder` vs `Bi-Encoder` 漏斗分工）**：

  * 粗召回双塔 `Bi-Encoder` 将 Query 与切片**独立编码**成单个向量再算余弦，切片向量可离线预计算建索引，毫秒级扫几十万条，但丢失了词与词之间的细粒度注意力交互。

  * 精排模型（`bge-reranker-v2-m3`）采用 **`Cross-Encoder`**：将 `[CLS] Query [SEP] Chunk [SEP]` **拼接在一起送入 Transformer 全层自注意力**，让问题里的限定词与原文每个字逐层交叉比对，精度极高；但代价是无法离线预计算索引，每次查询必须实时跑 `N` 次前向推理，耗时与候选数严格线性正比。因此采用「双路各 `50`（或三路各 `20`）→ `RRF(k=60)` 合并去重截断 `Top-30` → `Cross-Encoder` 精排取 `Top-6` 进上下文预算」的黄金三级漏斗，单机 `20 QPS` 下端到端检索+精排 `P95 ≈ 180ms`。

#### 3. 面试口述与连环追问

> **【面试口述】**两个项目我都搭了『多路粗召回 → `RRF` 融合 → 交叉编码器 `Rerank`』的三级漏斗。粗召回阶段双塔向量能离线建图算语义泛化，但对报错码、故障码和生僻专有名词很钝，所以我配了定制分词的 `BM25`（工业场景还单独加了一路故障码 `GIN` 数组精确匹配）。多路合并没用线性分数加权，是因为 `BM25` 无上界而余弦相似度挤在窄区间，极端高分做归一化会把正常候选压扁，改用 `k=60` 的 `RRF` 倒数秩融合只看排名不看绝对分值，既免调权重又天然奖励多路共识候选。融合出前 `30` 条再交给 `bge-reranker-v2-m3` 交叉编码器把问题和切片拼起来跑全注意力精排取前 `6` 条，在 NoteWeave 单轮评测里把 `Recall@10` 从纯向量的 `0.66` 拉到了 `0.87`、`MRR` 从 `0.51` 拉到了 `0.78`。

* **追问：用户多轮对话经常直接问一句「那它的最大扭矩是多少？」，直接拿这句去做 `BM25 + Vector` 检索肯定搜偏，你们怎么处理的？如果改写小模型超时或胡改怎么办？**

  > **答**：多轮指代消解必须在进检索漏斗之前做查询改写（Query Rewrite）。在 NoteWeave 里，我们用受限解码流式头让轻量模型结合最近话题把『它』补全成具体实体名生成独立查询 `s`，但我专门加了两道工程护栏：第一是时间护栏，限制 `64` 字符、`400ms` 硬超时，超时立刻回退用原始问题拼上当前活跃话题实体词去搜，不让改写拖慢主链路首字延迟。第二是防漂移护栏，核对改写句是否丢失了原问题里的高 `IDF` 专有编号（比如故障码或版本号），一旦模型自作聪明把精确型号改丢了，强制把原专有词拼回检索式里保底。

### 5.3 结构化切片底座与任务感知三链路（`QA` · `Note` 连续窗口 · `Wiki` 有界一跳 vs `GraphRAG`）

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 2 写到：**「面向问答、精读与知识沉淀定制证据粒度，QA 采用 BM25 + Vector 双路召回、RRF 融合与 Rerank，Note 采用资料级召回与连续原文窗口，Wiki 通过有界页面关系与来源回链组织长期知识」**。

#### 2. 系统设计权衡（共用一套索引底座，按策略模式分叉组装）

* **章节树结构化切片底座（优于定长硬切与昂贵语义切分）**：

  * 固定字符硬切会把跨页表格、代码块和章首适用前提拦腰斩断（制造业手册更会导致子块丢失小节标题上的适用机型与固件版本限定）；全量调 Embedding 算句间相似度做语义切分入库太贵太慢。

  * **项目解法**：解析还原文档章节树，按章节边界切约 `500` 字块，代码块与小表格整块保留，跨页大表格拆出的每个子块**自动前置补齐父表头**，工业手册还将章、节、表注里的子型号与固件限定**逐层继承下沉**写入切片元数据。

* **QA / Note / Wiki 三种证据粒度为什么分叉？**

  1. **`QA`（精准点状事实问答）**：重多源高精对比，走双路 `50` → `RRF 30` → `Rerank 6`，且把最高分证据排在证据区最前面防长文注意力衰减。

  2. **`Note`（长文精读归纳：两级资料定位 + 前后各 2 块连续窗口）**：精读往往聚焦某篇资料某一大节，若直接在全库碎切片里搜，前 6 条散落在五篇不同文章里拼不成连贯推理（按文档切片分求和又偏向长文、取最高分易被偶发词带偏）。故入库额外建「资料摘要」与「小节标题+首段」轻量索引项，先锁定最相关的 1～2 份资料与目标小节，再顺 MySQL `(doc_id, section_path, seq_no)` 联合索引把命中切片**前后各扩 `2` 块**拼成连续原文窗口并附上章首前提。

  3. **`Wiki`（长期知识沉淀：`BM25F` + 有界一跳扩展 + 段落级来源回链，为什么不上 `GraphRAG`？）**：

     * 检索用 `BM25F` 选 Top-3 种子页，顺「共享来源资料 / 显式主题引用」有向边**最多扩展一跳、上限 6 页**控住 Token 预算。

     * **为什么拒用重型 `GraphRAG`？** ① 全量让大模型抽三元组实体关系建图并做社区聚类摘要，Token 入库成本高出几个数量级；② **最致命的是无法低成本精准撤回**：一旦用户删掉某份原始资料，很难反推知识图谱里哪些融合边和社区摘要该同步擦除；而我们的有界页面结构在每个 Wiki 段落精确挂载来源 `(doc_id, chunk_id)` 回链，删资料时顺回链直接定位受影响页面做毫秒级/秒级局部重算并推高版本指针即可。

#### 3. 面试口述与连环追问

> **【面试口述】**为了避免一份资料存三套异构索引导致撤回一致性翻三倍，我底层共用同一套带章节树和父表头的结构化切片底座，只在召回组装层用策略模式分叉：`QA` 走双路加 `RRF` 精排拿高密度点状证据。`Note` 精读先在资料摘要和小节级索引定准章节，再顺联合索引把命中块前后各扩 2 块拼成连续原文窗口，防止证据散落断章取义。`Wiki` 用 `BM25F` 取前 3 个种子页做最多 6 页的有界一跳扩展，每个段落绑定来源资料回链。之所以没跟风上 `GraphRAG`，是因为全量抽实体关系建图成本太高，而且一旦用户撤回某篇资料，图谱里的融合边和社区摘要极难干净剥离，而段落回链加有界一跳在删资料时只需顺回链局部重算受影响页，工程可控性好得多。

* **追问：在 `Note` 精读链路里，你为什么要分两步「先搜资料和小节级摘要索引、再顺联合索引扩前后各 2 块连续窗口」，直接把 Top-20 碎切片按文档分组求和选最高分的文章不行吗？**

  > **答**：早期试过直接按切片得分聚合选文档，踩了两个明显的偏差：如果对同一篇文档命中的切片分数做求和（Sum），一篇 200 页啰嗦的综述因为切片多、处处擦边，总分很容易碾压那篇只有 5 页但字字切题的核心设计文档。如果改取单块最高分（Max），某篇无关文档附录里刚好出现一句一模一样的术语就会鸠占鹊巢。给每篇资料生成『全文摘要项』和『小节标题加首段项』做轻量两级定位，相当于先看目录选准章节，再顺 MySQL `(doc_id, section_path, seq_no)` 把上下文前后各扩 2 块连带章首前提整段端出来，论证链条完整不碎。

## 六、AI Agent 工程架构、协议、上下文记忆、评测体系与推理底座考点

### 6.1 `Table-as-State` 深度研究、`Plan / Replan`、`分层 Verifier` 与工业 `HITL` 边界

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 1 提出核心架构 **「以 `Table-as-State` 为核心的 `Deep Research Agent`」**，而在制造业职责 3/4 则采用 **「隔离式单步受控流水线 + `HITL` 人工在环」**。高频深问点：Agent 常见编排范式各自有什么缺陷？`Table-as-State` 怎么克服的？为什么跟 `LangGraph` 不一样？为什么制造业不用自主 Agent？

#### 2. 系统设计深度对比与工程机制

* **主流 Agent 编排范式演进对比**：

  1. **自由 `ReAct`（Reasoning + Acting 循环）**：边想边调工具把所有 Observation 不断往一个消息列表里塞——步数一多（10+ 步），上下文急剧膨胀稀释注意力，极易**漏查研究维度、目标漂移或在查不到的死胡同里原地打转**。

  2. **静态 `Plan-and-Execute`**：开局一次性列死线性步骤列表，执行途中发现某篇博客没写具体 JDK 版本号或某概念需拆细时，缺乏精准定位哪个单元缺证据并局部改词补查的机制。

  3. **`Reflexion`**：靠模型自我反思追加文字教训，反思文本仍堆在上下文里且同模型「自己审自己」极易顺着错误推理自我说服（Sycophancy 附和偏差）。

  4. **`NoteWeave Table-as-State`（显式数据库网格状态机）**：

     * **结构外置**：Planner 用 `Structured Output` 生成「研究对象（最多 8 行）× 待验证字段（最多 10 列）」二维状态表落入 MySQL，每个格子（Cell）是拥有独立验收口径的**最小可验证原子单元**。

     * **上下文隔离的有界 Worker**：每个子任务 Worker 只拿当前**单个格子**的口径、已有证据与上次打回原因，在**最多 `6` 步**有界循环内调「工作区混合检索 / 公网搜索 / 网页快照抓取」取证，互不污染上下文，支持多格并行。

     * **剥离推理草稿的双层异构 `Verifier`**：第一层**确定性 Java 代码**硬核验来源 ID 存在、起止字符偏移量合法、截取原文逐字匹配及量纲单位换算；第二层**剥离 Worker 冗长推理思考过程**（防止被绕晕说服），仅将「验收口径 + 候选结论 + 原文片段」喂给异构家族轻量模型（如 `GLM-4-9B`，区别于主模型 `Qwen2.5-72B`）低温核验语义与版本前提。

     * **缺口驱动局部 `Replan` 与判环**：外层仅扫描状态为缺口的格子，结合打回原因改写检索词（单格最多补查 `3` 次，整场最多 `5` 轮，近似重复查询跳过；同口径权威来源矛盾进「证据冲突」终态保留双方引用，查无实据进「证据缺口」终态如实披露）。若粒度太粗需父格归档拆细子格，新增依赖边先过 **Kahn 入度拓扑排序**，残余子图跑**三色 DFS** 揪出环边拦截。

     * **成文阶段断网禁工具**：所有格子终态后，Writer 只收已采纳格子的结论与证据表，**挂载零工具**（成文阶段模型为了行文对称最爱临场编数据，断绝工具并做句末引用编号代码反查，倒逼只能写表内已核实事实）。

     * **公网不可信网页四层安全防线**：① 网页正文包进带边界声明的数据围栏（仅作资料不作指令）；② 锁死搜索引擎返回的原始 URL 白名单禁拼接参数防数据外带；③ 拦截 `127.0.0.0/8`、`10.0.0.0/8`、`169.254.169.254` 云元数据等内网地址防 **SSRF**，并在实际建连前二次校验 DNS 解析 IP 防 **DNS Rebinding（重绑定攻击）**；④ Worker 仅持只读检索工具无写副作用 + 异构 Verifier 终审。

  5. **对比 `LangGraph` 状态图**：`LangGraph` 擅长管节点跳转控制流，但它的全局 `State` 是单个大对象（靠 `Annotated` `reducer` 合并并发分支输出），多执行者跨进程并发修改不同格子并拦截超时慢节点迟到写回仍需自己造锁；拆成 MySQL 单格行记录可直接利用行锁与 `Fencing Token` 独立并发提交。

* **为什么制造业平台不用自主多轮 Agent 而坚持固定流水线 + `HITL`？**

  * 工业拆修涉及强电柜高压电击、液压蓄能器残压喷射与 ERP 库房领料扣账，安全零容错，且单卡 A800 总共仅 `10` 路并发配额。做成开放 ReAct 循环不仅把耗时拉长到三四十秒吃光显卡配额，还曾出现漏写断电验电挂锁（LOTO）与混用 `DX-560B` 不同功能部件轴承（主轴前端 `70` 系列角接触球轴承 vs 进给丝杠 `TAC` 系列推力支撑轴承）及不同产线选配主轴（`BT40` vs `HSK-A63`）的坏例。因此坚持**单步受控生成 + Java 策略链硬校验 LOTO 与选配部件子 `BOM`（不过带报错自动重修 1 次）+ 班组长 `HITL` 事前一键审批冻结快照后再异步提单 CMMS**，一次审批通过率达 `80.9%（93/115）`。

#### 3. 面试口述与连环追问

> **【面试口述】**自由 ReAct 把所有搜索观察都堆在一条对话历史里，超过十步就容易注意力稀释漏查维度。静态 Plan-and-Execute 又没法针对查漏的字段局部改词补查。所以在 NoteWeave 里我设计了 `Table-as-State`，把研究状态外置成 MySQL 里最多 8 行乘 10 列的『对象 × 待验证字段』状态表，每个 Worker 只拿单格口径在 6 步内独立取证，跑完先过 Java 偏移量和单位核验，再剥离推理过程交给异构家族的 `GLM-4-9B` 做双层 `Verifier`，只对没过的缺口格局部 `Replan`（拆格时跑 Kahn 加三色 DFS 判环），最后成文阶段拔掉所有工具只准按表写作，把 20 道冻结研究题的单元完成率从 `67%（94/140）` 提到了 `83%（120/145）`。反过来在制造业实习项目里，因为拆修关乎高压电安全且单卡 A800 只有 10 路配额，我们坚决不用开放多轮 Agent，而是走固定单步流水线加 LOTO 安全前提、选配子 `BOM` 硬规则校验和班组长 `HITL` 事前审批，这就是我理解的 **Harness Engineering**——根据场景容错率给概率模型套上恰当强度的确定性护栏。

* **追问：在 NoteWeave 的 `Table-as-State` 里，如果遇到两份公开权威资料对同一个指标说法互相矛盾，或者全网根本查不到某个冷门字段，Worker 会不会一直死循环补查下去？**

  > **答**：不会，我们在状态机里明确设计了有界退出预算和两个诚实终态。预算上单格最多补查 `3` 次、整场最多重规划 `5` 轮，且每次生成的补查词如果跟历史已查词余弦或词集高度重合会直接跳过防原地踏步。终态上严禁强迫模型二选一瞎猜：如果两份同口径高可信资料经过异构 `Verifier` 核实确实结论相反，格子直接转入『证据冲突（CONFLICT）』终态，成文时同时并列呈现双方观点与各自出处。如果 3 次换词补查仍无可靠依据，转入『证据缺口（INSUFFICIENT）』终态并在报告末尾显式列出未核实项，把低幻觉落到实处。

### 6.2 `Context Engineering`、`Prefix KV Cache` 物理原理、长期 `Memory` 与 `信息缺口门控`

#### 1. 核心定位与常考主线

简历在 NoteWeave 职责 3 与开源贡献 `TencentDB Agent Memory` 双重聚焦上下文与记忆治理：一边是 **「分层编译 `Topic-aware Window`、会话持续约束与增量摘要……经『`候选提取—门控晋升`』沉淀长期 `Memory`，限定于表达参数控制并与资料 `Evidence` 事实层隔离（Token 降 `34%`、事实通过率 `92%`）」**；另一边是 **`MemoryProxy`** 的 **「`信息缺口门控`替代关键词触发 + 五段固定前缀装配」**。

#### 2. 底层机制与系统设计权衡

* **`Prefix KV Cache`（前缀缓存）物理机制——串联三段经历的核心性能铁律**：

  * 自回归大模型（Decoder-only）受**单向因果掩码（Causal Mask）**约束，第 `t` 个 Token 的 Key/Value 状态严格依赖前 `0 ~ t-1` 个 Token 的精确序列。推理引擎（如 vLLM `Automatic Prefix Caching` 基于 `PagedAttention` 物理块，每块 16/32 Token）对每个块计算**包含前序所有块哈希的级联块哈希（Block Hash）**。

  * **一字节击穿灾难**：只要提示词在最前面第 100 个 Token 处塞了一个每轮跳动的当前秒级时间戳、或者逐轮动态更换了置顶工具卡/摘要，从第 100 个 Token 往后的**整段几千乃至几万 Token 历史与源码 `KV Cache` 全部哈希失配作废**，被迫重新跑极其耗算力的 `O(N^2)` Prefill。

  * **三段经历统一的置顶防击穿架构**：

    1. **NoteWeave 七段编译（总预算 `16,384 Token`）**：将 **`[1] 静态系统指令（1,200）+ [2] 会话持续约束（200）+ [3] 不可变话题摘要（1,500）`** 合计 `2,900 Token` 死死钉在最前面，且未覆盖消息攒够 **`4～6` 条步长（连续 `2～3` 轮问答）** 才经 Kafka 异步升版摘要，窗口期内缺口按 `(session_id, msg_seq)` 补拉原文放在动态第 4 段——保证连续 2～3 轮追问期间前 3 段**逐字节恒定**；两级 `[#序号]` Provenance 定位回放、当轮重检 `Evidence`（`3,200`）、长期记忆表达块（`200`）与当前问题依次排在动态尾部区。

    2. **TencentDB `MemoryProxy` 五段固定装配**：早期每轮自动检索记忆塞进前缀直接打碎几万字代码缓存而下线；我改造后固定 **`[1] 共享协议 + [2] 信息缺口门控 + [3] 会话级能力裁剪工具卡`** 三段静态置顶（进程内按 `模板版本 + 会话能力签名` 缓存），动态目录置底，宁可只做会话级静态压缩 `27.02%`，也**绝不做逐轮 Query 动态抽 1～2 张工具卡（省几百字却击穿后面几万字源码 KV Cache，因小失大）**。

    3. **制造业静态 Schema 置顶**：保持全局固定静态 `JSON Schema`（绝不把每单动态变化的候选切片 ID 写进 Schema `enum`），常驻命中 vLLM 服务端受限解码有限状态机（FSM）编译缓存。

* **NoteWeave 零新增串行调用的 `i/r/d/s` 流式路由与长期 Memory 四道门控**：

  * **流式四行头**：改写小模型受限解码流式输出 `i`（资料问答/只改表达/设定约束/超出范围，`780` 轮准确率 `726/780 ≈ 93%`，误判不检索仅 `4/612` 轮）、`r`（目标话题路由）、`d`（是否需早期细节回放）、`s`（独立查询），设 `64` 字符/`400ms` 超时护栏，超时自动退回资料问答 + 高 `IDF` 词覆盖与话题均值余弦规则退路。

  * **为什么自动记忆会污染事实，怎么彻底隔离？** 若把对话中临时讨论的猜测或旧版文档数字自动存进跨会话记忆，下周资料更新后旧记忆就会像幽灵一样覆盖新事实。因此严守**「事实每轮从资料重检 `Evidence`，跨会话长期记忆只存程序性表达规范」**：仅用数据围栏包裹用户本人消息抽取 **`8` 个正交表达槽位**（语言/篇幅/风格/约束/结构/表格/术语规范/交互），主表建 `(user_id, slot, scope)` 唯一约束（全局用非空哨兵 `'GLOBAL'` 替代 `NULL`，规避 MySQL 唯一索引允许多个 `NULL` 的大坑）；经① `Beta(α, β)` 后验平滑置信度、② `EMA` 指数移动平均效用、③ 风险分 `<0.70`、④ 剔除单轮临时要求四道门控无冲突才升 `ACTIVE`，任何负反馈或效用跌破 `<0.40` 直接合并降级回 **`PENDING_CONFIRM（待确认）`** 移出自动注入池。

* **编码宿主读写护栏与 `MemoryProxy` 前缀装配的职责边界**（防混谈官方宿主机制与开源贡献）：

  * **`TencentDB MemoryProxy` 代理层（本人参与部分）**：负责五段固定顺序装配（前三段协议、门控与会话裁剪工具卡置顶锁死，接近上下文窗口上限时从中部较早的工具观察结果整块反向折叠），保护仓库级源码 `Prefix KV Cache` 不被系统头抖动击穿。

  * **编码 CLI 宿主层常见本地文件护栏（如 `Claude Code / Codex CLI` 宿主机制）**：读万行大文件严禁一次性整文件塞爆窗口，先跑 `ripgrep` 限条数搜行号 → 再用语法树 `AST` 提取类与函数签名大纲 → 最后按 `Read(offset, limit)` 分段精读目标 `100～200` 行；改代码写盘前记录上次读取时的文件 **`SHA-256` 摘要（Read-before-Write）**，未读过的文件禁止直接盲改，落盘前重算磁盘哈希一旦失配（说明期间用户手动改过代码）立即阻断写入并要求重读合并。

* **TencentDB 读取侧「全局三步信息缺口门控」**：

  * 为什么不用关键词（`87.14%` 误调用）、不用向量相似度路由（分不清「主题相关」与「窗口缺证据」）、也不挂前置 7B 路由小模型（看不全几万字本地代码与多步同轮新 Observation，全传又多一跳长文 Prefill 延迟）？

  * 复用握有完整上下文的主模型执行三步判断：① **判窗口充分性**（自包含编码或已在对话/`L3` 画像/前序返回中出现则拒识，同时钉死两条防漏调硬边界：**`L2` 路径摘要不等于场景正文，`Skill` 名称简述不等于流程正文**）；② **按证据类型优先级路由家族**（事实约定走 `Memory`、步骤模板走 `Skill`、跨文件调用图谱走 `Knowledge`）；③ **最小跳步够用即停**。有效负例误调用率从 `87.14% (122/140)` 暴降至 `31.94% (46/144)`（坦诚正例发出率 `ECR` 由 `96.08%` 回落至 `77.88%` 的召回换精度权衡）。

#### 3. 面试口述与连环追问

> **【面试口述】**做长会话和编码 Agent 上下文工程时，最容易踩的两个坑是『打碎 `Prefix KV Cache`』和『记忆污染事实』。因为因果掩码要求从第 0 个 Token 起逐字节一致才能复用块级哈希缓存，我在 NoteWeave 七段编译里把静态指令、会话约束和不可变摘要前 3 段 `2,900 Token` 置顶，攒够 `4 到 6` 条消息才异步升版摘要、滞后差额用原文补在动态第 4 段，让同话题连续两三轮追问前缀逐字节不变。在 TencentDB 里也是同样道理，固定前三段静态协议和会话级裁剪工具卡，不做逐轮换卡免得击穿后面几万字源码缓存。至于记忆治理，两个项目正好一写一读互补：NoteWeave 是**写入侧门控**，坚持事实每轮重检资料，长期记忆只从数据围栏用户消息里抽 8 个表达槽位，过 `Beta` 置信度和 `EMA` 效用等四道门控才晋升、负反馈降回 `PENDING_CONFIRM`，平均输入 Token 降了 `34%`（`9,860 -> 6,510`），250 个检查点事实通过率从全量回放截断的 `89%` 提到 `92%`。TencentDB 则是**读取侧信息缺口门控**，复用主模型先判窗口缺不缺证据并卡死『目录摘要不等于正文』两条防漏调边界，不增加额外前置模型往返延迟，把误调用率从 `87.14%` 压到了 `31.94%`。

* **追问：既然 `TencentDB` 工具说明压缩后还有 `2,567.5 Token`，为什么不在每轮用户提问时用向量检索动态只挑最相关的 1～2 张工具卡塞进系统提示词，把这 2,500 Token 再省掉两千？**

  > **答**：如果只看单轮系统提示词长度好像省了两千 Token，但在真实编码会话里算总账其实是巨亏的。`Codex CLI` 或 `Claude Code` 跑一个仓库任务往往连续交互十几轮，上下文中间挂载着两三万 Token 的本地源码文件。因为自回归因果注意力要求从第 0 个 Token 起前缀字节一致才能命中 `Prefix KV Cache`，一旦我们在排最前面的系统提示词里每轮动态换工具卡，后面那两三万 Token 的源码缓存每一轮都会全部失效重算 Prefill，既慢又贵。所以我们坚持只做『会话级能力签名静态裁剪』并锁死前三段前缀，守住整场会话的缓存命中率。

### 6.3 `Structured Output`、`MCP`、`SKILL.md` 五段流水线与运行时契约工具卡

#### 1. 核心定位与常考主线

简历密集出现了四大结构化与工具协议关键词：**`Structured Output`**、**`MCP`**、**`SKILL.md + Schema`**、**`运行时契约生成工具卡`**。面试中常把 `Function Calling`、`MCP`、`Skills`、`A2A` 放在一起考正交分层。

#### 2. 底层机制与工程落地细节

* **`Structured Output`（受限解码 Guided / Constrained Decoding）底层原理与能力边界**：

  * **怎么做到 100% 语法不报错？** 不同于只在提示词里求模型「请输出 JSON」，推理引擎（如 vLLM 集成 `outlines / xgrammar`）将 `JSON Schema` 离线编译为上下文无关文法（CFG）或**有限状态机（FSM / Pushdown Automaton）**；在自回归每一步 Decode 生成下一个 Token 前，根据当前状态机所处位置动态算出允许接续的合法词表子集掩码（Token Mask），将所有破坏括号闭合、缺必填字段或类型错乱的非法 Token 的 `logits` 直接置为 `-∞`（概率归零）。

  * **两大工程边界**：① **只管语法结构合法，不管内容事实真假**——模型完全可以在合法的 JSON 字段里填一个编造的页码或漏掉安全断电步骤，所以必须配「前置证据门控 + 后置确定性代码校验（偏移量/页码/压力扭矩正则/LOTO/子 BOM）+ 局部带错重修 1 次」；② 保持全局固定静态 Schema 以复用服务端 FSM 编译缓存，同时客户端显式检查 `finish_reason != 'length'` 拦截超长截断半截 JSON。

* **四大 Agent 协议正交分层全景**：

  1. **`Function Calling`**：模型层单步原语——模型把自然语言意图转成结构化函数名与参数 JSON，工具怎么注册和执行耦合在单个宿主应用进程内。

  2. **`MCP`（Model Context Protocol）**：宿主应用（Host/Client）连接外部工具与数据源（Server）的标准化进程间/跨网协议，基于 **`JSON-RPC 2.0`** 暴露 `tools/list`、`tools/call`、`resources`、`prompts`。本地进程通信走 `stdio`，远程通信已从早期难过企业网关的双通道 `HTTP + SSE` 演进为单端点按需升级流式并支持断线续传的 **`Streamable HTTP`**。

     * **NoteWeave `MCP` 落地细节**：严守全项目仅封装 **2 个重依赖多模态工具**——① `faster-whisper` 语音转写工具；② 视频关键帧抽取与板书多模态理解工具（读取真实显示时间戳 `PTS`，在 `ProcessPoolExecutor` 中计算 **64 位 DCT 感知哈希 `pHash`**，相邻帧汉明距离 `< 10` 判为重复画面滤除编码噪点，入库全片稀疏抽帧与讲义生成局部时间窗高分辨率补抽复用同一工具的不同档位参数）。传输大视频不走 JSON Base64 塞爆报文，而是传 **15 分钟有效期的 MinIO 只读 `GET` / 单次受限目录 `PUT` 预签名 URL**；启动时校验工具描述哈希防 **MCP 工具描述投毒（Tool Poisoning）**。

  3. **`SKILL.md`（渐进式规程包）+ 五段流水线**：首轮仅向模型暴露轻量目录简述，命中任务才加载完整 `SKILL.md` 写作规范与 `JSON Schema` 渲染契约。NoteWeave 用**模板方法模式**固定「取材（冻结下单时资料 `proc_version`）→ 规划（每页独占论点素材）→ 写作（逐页受限解码防一次直出 20 页尾部注意力退化截断）→ 代码校验（超宽/字数/引用核验，单页异常仅局部重修该页 1 次）→ 策略渲染（`python-pptx` / `XeLaTeX`）」五段骨架，新增产物类型仅需加一份契约目录与渲染策略类。

  4. **TencentDB 零侵入 `Shell + curl` + 三层运行时契约工具卡编译器**（对比 MCP）：因产品要求不改 `Codex CLI / Claude Code` 一行代码、不让用户本地装 MCP（只需改一行 API Base URL 指向 `MemoryProxy`），故借宿主原生自带的 `Shell` 发 `curl` 调 `Bridge` 网关（安全鉴权由服务端网关按会话令牌强校验，只读会话乱拼写接口直接返 `403`）。为解决无原生 Schema 易拼错参数断链，设计「底层 `Runtime Contract` 对齐源码路径与必禁参 → 中层 `Strategy IR` 写明成对适用/避开边界、相邻工具区分及同次业务成功响应的 `Skill ID + 版本号 + 路径` 强绑定 → 顶层 `Capability Pruning` 会话级裁剪」三层编译器，配 `7` 文件 `183` 项单测（含故意删改限制词必报错的负向断言），将工具说明从 `3,518.0` 压至 `2,567.5 Token`（**-27.02%**），条件首步命中率从 `27.55%` 提至 `74.07%`。

  5. **`A2A`（Agent-to-Agent Protocol）**：面向跨团队/跨组织黑盒自治 Agent 对等协作，通过 `Agent Card` 发现能力并围绕长耗时状态机 `Task` 交换 `Artifact` 产物（与面向确定性工具调用的 `MCP` 互补）。

#### 3. 面试口述与连环追问

> **【面试口述】**这几个协议处于不同层级：`Function Calling` 是模型输出函数参数的单步原语，工具耦合在单应用里。`MCP` 用 `JSON-RPC 2.0` 统一了宿主与外部工具服务的通信，我在 NoteWeave 里把吃显存和依赖 `FFmpeg` 的 `faster-whisper` 转写与 `pHash` 关键帧理解拆成独立 `Streamable HTTP` MCP 服务，传 15 分钟 MinIO 预签名链接免传大字节流，让研究和产物两个模块直接共享。而产物内部用 `SKILL.md` 管怎么写好、用静态 `JSON Schema` 受限解码屏蔽非法词表保证每页结构能被 `python-pptx` 和 `XeLaTeX` 稳定渲染，遇到超字数只单页重修 1 次。到了开源项目 TencentDB 里，因为透明代理要求用户不装插件只改一行 Base URL 接入第三方 CLI，没法挂 MCP，我就设计了运行时契约、策略表示、能力裁剪三层编译器配 183 项单测生成 `Shell + curl` 工具卡，强绑定同一次有效响应的版本号和附件路径，把 Token 压了 `27.02%`，首步命中率从 `27.55%` 拉到 `74.07%`。

* **追问：在 `TencentDB` 里模型是通过宿主的 `Shell + curl` 调后端网关的，提示词毕竟只是软约束，万一模型幻觉或遭遇提示词注入拼了一个删除命令，怎么保证安全？**

  > **答**：在我们的架构铁律里，提示词里的运行时契约工具卡**只负责提高模型的调用准确率，从来不充当安全防线**。真正的安全边界全部收口在服务端 `Bridge` 网关鉴权层：每个编码会话颁发有明确作用域的会话令牌，网关根据令牌强校验账号归属的工作区与读写范围，只读会话一旦模型乱拼出写接口或跨团队 ID，服务端直接硬拦截返回 `403 Forbidden`。同时在契约编译器的 `7` 个文件 `183` 项单测里专门写了负向断言，谁不小心删改了关键必禁参约束，CI 流水线当场红灯报错。

### 6.4 `Agent Evaluation` 评测方法论、LLM 推理底座（`GQA` · `FlashAttention`）与微调边界

#### 1. 核心定位与常考主线

简历三段经历全部给出了极其扎实的定量评估指标，尤其开源贡献构建了 `39` 个仓库、`1,140` 条正负样本基准与受控对照框架。高频深问点：**怎么防过拟合和刷分？为什么不用 LLM-as-a-Judge？为什么 `Complete` 翻倍但 `Strict` 涨得少？单卡 A800 显存怎么算出来的？为什么不上 SFT 微调？**

#### 2. 评测防作弊体系与底层推理算力账本

* **三段经历四大评测防作弊硬核设计**：

  1. **防时间穿越与同源泄漏（制造业 `Hit@6: 85%`）**：初版随机切分 180 道有解题跑出 `165/180 (91.7%)` 虚高，排查发现混入了故障发生之后才补录的事后完修案例及同一异常轮次的衍生题；重做**按工单发生时刻可见知识批次截断 + 按独立异常轮次簇分组隔离**后，剔除 12 道穿越题拿到真实 `153/180 = 85.0%`（另 20 道超纲无解题生成前门控 100% 拦截）。同时用 **2×2 四格表**对平 `153` 道 `Hit@6`（`148` 放行 + `5` 擦边附注拦下）与 `156` 张放行诊断卡（`148 + 8` 基础 SOP 放行），`371/390 = 95.1%` 获工程师逐条核验支撑；线上用两条同构产线、甲乙两班组 **4 周按周交叉轮换** + CMMS 硬节点时间戳取中位数（`20.5 -> 13.2min`，`-35.6%`）抵消人与设备偏差。

  2. **防少拆格刷分与裁判同源偏见（NoteWeave `67% -> 83%`）**：研究单元完成率以规划总格数为分母（`94/140 -> 120/145`），为防止 Planner 故意少建难查的列刷高比例，强制统计对比题点名实体覆盖率，并用**异构模型家族评 3 次取多数投票**逐项核对每题预埋的 3 个必答要点。

  3. **资产先行反推 + 逐字节正负 Pair + 双口径恒等式自证（TencentDB `test1k`）**：

     * 基于 `39` 个真实仓库固定 Commit，先从真实代码与提交历史提炼记忆/技能资产，再反推构造 **`464` 组逐字节完全相同的用户 Query 正负配对**（正例窗口缺答案必须调，配对负例窗口已贴出答案严禁调，外加 `109` 条同主题外队干扰 + `103` 条纯通用编码 = `676` 负例，合计 `1,140` 条），冻结前过 3 项防泄题扫描，并采用**确定性工具调用轨迹漏斗规则判分**（检验真实 `Shell` 执行记录、HTTP 状态码与跨步参数绑定，拒绝噪声大的 `LLM-as-a-Judge` 看回答文本打分）。

     * **主动坦诚双口径防缩分母质疑**：前 `250` 条受控对照有效样本（Baseline `242 = 102正 + 140负`，V4 `248 = 104正 + 144负`），汇报简历上的已发出条件首步命中率 **`TSR_cond: 27.55% (27/98) -> 74.07% (60/81)`** 时，同步给出全量有效正例口径 **`TSR_all: 26.47% (27/102) -> 57.69% (60/104)`**，二者严格满足恒等式 `TSR_all = ECR × TSR_cond`，堂堂正正证明真实验证命中数从 `27` 条翻倍涨到了 `60` 条，绝非靠压低 `ECR` 缩分母刷出来的。

     * **深度归因：为什么 `Complete` 从 `25.49% (26/102)` 翻倍到 `55.77% (58/104)`，而一步不多调的 `Strict` 仅从 `15.69%` 到 `19.23%`？** 通过恒等式 `Overcall = ECR - Strict` 拆成两半看：**未完链盲目乱试（`ECR - Complete`）从 `72/102 (70.59%)` 暴砍超三分之二降至 `23/104 (22.12%)`**；而**完链后求稳多查一步（`Complete - Strict`）从 `10/26` 变为 `38/58`**——这是典型的**难度迁移（Simpson 效应）**：Baseline 完成的 26 道大多是简单的 1 跳直读题，而 V4 新救活的 `+32` 道全是复杂的 2 跳/3 跳跨工具链路，编码模型在改代码前习惯保守再发一次确认查询，这也直接驱动了下一步在 `Bridge` 网关层做等价检索幂等短路与返回头增加 `sufficiency=complete` 停止信号。

* **LLM 推理显存估算与调度加速（制造业单卡 A800 `80GB` 10 路并发账本）**：

  * `Qwen2.5-32B-Instruct-AWQ`（4-bit 权重量化）模型权重占约 **`18～20 GB`**；64 层 Transformer，采用 **`GQA`（Grouped-Query Attention，分组查询注意力：`40` 个 Query 头每 5 个共享 1 组 KV，仅保留 `8` 个 KV 头，每头维度 `128`）**，将 `KV Cache` 显存直接压缩至传统多头 `MHA` 的 **`1/5`**（兼顾多头表达力与低显存，优于全共享单头的 `MQA`）。

  * **单 Token `KV Cache` 手算公式**（FP16 半精度占 `2 Bytes`，K 和 V 各一份乘 `2`）：

    ```formula
单 Token KV Cache = 2 (K/V) × 64 层 × 8 KV头 × 128 维 × 2 Bytes (FP16) = 262,144 B = 256 KB/Token
```

  * `10` 路并发（诊断 `4` 路 + 草稿 `6` 路）× 每路 `16k` 上下文 = `256 KB × 16,384 × 10 ≈ 40 GB`，加上 `20 GB` 权重与激活值约 `70 GB`，在 `80 GB` A800（vLLM `gpu_memory_utilization=0.9`）上留有约 `10 GB` 安全余量不触发抢占重算。

  * **底层算子与调度加速**：`RoPE` 旋转位置编码通过复数平面旋转使注意力内积仅依赖相对距离；Prefill 算力受限、Decode 显存带宽受限，**`FlashAttention`** 将 Q/K/V 分块加载进 GPU 高速片上 `SRAM` 配合 `Online Softmax` 一趟算完，免去读写 `O(N^2)` 巨型 `HBM` 注意力矩阵；**`Continuous Batching`（Iteration-level 连续批处理）** 在每个生成步踢出已输出 `EOS` 完结的请求并立刻补入新排队请求，配合 `PagedAttention` 按非连续页块管理显存消除内外碎片。

* **Agent 全链路压测与四个可观测性黄金信号**：

  1. **延迟（Latency）**：不能只看平均耗时，必须拆开 **`TTFT`（首字延迟，反映混合检索耗时与长文 Prefill 排队）**、**`TPOT`（每词生成间隔，反映 Decode 显存带宽瓶颈）** 与端到端 `P95/P99`，且压测流量必须按真实长短会话分布回放，防止全用同一句短 Prompt 全命中 `Prefix Cache` 测出虚假好看的数字。

  2. **流量（Traffic）**：除入口请求 QPS 外，重点盯「单次用户会话触发的下游模型/工具调用放大比」与循环步数分布，防止异常重试风暴把单次提问放大成几十次下游请求。

  3. **错误（Errors）**：流式与 Agent 场景最怕「HTTP 外层返回 `200 OK` 的假成功」——必须通过后置解析器监控 `finish_reason == 'length'` 超长截断、引用编号越界、数值正则失配以及 MCP 工具返回体 `isError=true` 的业务软错误率。

  4. **饱和度（Saturation）**：推理侧紧盯 vLLM **`gpu_cache_usage_perc`（`KV Cache` 显存占用率一旦超 `90%` 触发 `Preemption` 换出重算，尾延迟会瞬间翻几倍）** 与等待队列长度；应用侧同步监控工作区 `ZSET` 4 槽满载率、线程池队列水位与 `HikariCP` 活跃连接数。

* **什么时候选 `RAG` vs `LoRA SFT` vs `DPO / GRPO`？**

  * **高频动态事实、权限范围隔离、秒级撤回与原文页码溯源 → 必选 `RAG`**（微调记不住精确故障码扭矩且撤回资料无法从权重里擦除）。

  * **固化特定垂直输出格式、领域黑话或私有 DSL → 选 `LoRA SFT`**：冻结原权重 `W0`，旁路训练低秩矩阵 `ΔW = (α / r) · B · A`（`r << d`）——**必考初始化细节：**矩阵 `A` 用高斯随机初始化、矩阵 `B` 用全 `0` 初始化****（保证训练第 `0` 步 `ΔW = B · A = 0` 不破坏预训练底座，若两边全 `0` 则梯度死锁为 0 无法更新），上线前离线合并 `W' = W0 + (α / r) · B · A` 实现**零额外推理延迟**。

  * **对齐偏好与多步工具决策强化 → 选 `DPO` 或 `GRPO`**：有成对正负偏好样本用 `DPO` 闭式隐式奖励直接优化免训奖励模型；像我们有确定性单测或工具轨迹判分器时用 **`GRPO`**，同题采样一组轨迹按组内均值标准差归一化算优势，省去与主模型同规模的 Critic 价值网络省近半显存。

#### 3. 面试口述与连环追问

> **【面试口述】**做 Agent 优化如果先改提示词再找几个例子试，很容易拆东墙补西墙，所以我三段项目全是评测先行。比如开源项目构建 `test1k` 时，我基于 39 个仓库固定提交反推造了 464 组逐字节相同提问的正负 Pair，专门考模型能不能区分『主题相关』和『窗口真缺证据』，并用确定性轨迹规则判分替代不稳定的 LLM 裁判。汇报首步命中率从 `27.55%` 提到 `74.07%` 时我也主动同步报全量口径 `26.47% -> 57.69%` 自证没靠缩分母刷分，还通过拆解 `Overcall` 发现未完链乱调已经暴降三分之二，剩下的多调主要源于多跳难题救活后的求稳复查。在底层模型算力上，实习项目单卡 80G A800 跑 `Qwen2.5-32B-AWQ` 之所以定 10 路并发，是我按它 64 层、`GQA` 40 个查询头共享 8 个键值头手算出来的：半精度下每 Token `KV Cache` 正好 `256 KB`，10 路 16k 满载占 `40 GB`，加 `20 GB` 量化权重刚好留出安全余量不触发 vLLM 抢占重算。

* **追问：如果追问指标表里`TencentDB` 误调用率虽然从 `87.14%` 降到了 `31.94%`，但正例发出率 `ECR` 也从 `96.08%` 降到了 `77.88%`，是不是门控把本来该调的也误拦了？**

  > **答**：这是一个非常真实的『召回换精度（Precision-Recall Trade-off）』工程取舍，我在实验报告里专门做了归因分析。Baseline 之所以正例发出率高达 `96.08%（98/102）`，根本不是因为它懂什么时候缺信息，而是它不分青红皂白对几乎所有沾边提问无脑全调（所以负例误调用也高达 `87.14%`），而且那 98 次发出里真正首步调对的只有 `27` 次（全量首步命中仅 `26.47%`）。收紧信息缺口门控后，虽然在部分边界隐晦样本上少了 `18.20` 个百分点的发出（其中未完成的 46 道里包含 `23` 道漏调），但全量有效正例上的真实首步命中数从 `27/102` 翻倍涨到了 `60/104（57.69%）`，完整走通多跳必要链的样本从 `26/102` 翻倍涨到了 `58/104（55.77%）`，整体有效产出翻了一倍多，用户体验从『每句都被慢吞吞乱调打断』变成了高命中按需触发。

### 6.5 Prompt 结构、四类消息与 Agent Loop / Workflow 编排

#### 1. 核心定位与常考主线

系统 Prompt、用户问题、检索证据和工具返回在可信度、生命周期与缓存特性上完全不同，不能拼成一段无边界字符串。Agent Loop 与 Workflow 的选择也不取决于模型强弱，而取决于路径能否事先写死、是否需要根据环境反馈动态决策，以及长任务的状态、终止条件和恢复方式。

#### 2. 底层机制与高频考点

* **Prompt 分层与四类消息注入**：

  1. **系统消息**：放角色、不可变边界、输出契约与固定流程，尽量前置且稳定，服务 Prefix Cache；不要把每轮变化的候选 ID、时间戳或工具卡塞进去。

  2. **用户消息**：只放当前真实请求与必要参数，和历史讨论、系统规则隔离；临时要求不能被错误沉淀成长期事实。

  3. **检索消息**：标注来源、版本、页码/偏移与数据围栏，明确「资料不是指令」，网页或文档里的提示词不能越过系统权限。

  4. **工具消息**：只回填结构化结果、错误码和可重试标志，大结果先裁剪或外置引用；不能把堆栈、密钥或无关 HTML 全塞进窗口。

* **Agent Loop、Workflow 与终止条件**：

  * **Workflow**：步骤、分支和重试边界由代码预先确定，适合固定流程、强审计、低延迟和可回放；Agent 适合需要现场读环境、选择工具或改写路径的任务，常见生产形态是外层固定工作流，内嵌少量 Agent 节点。

  * **Agent Loop 基本骨架**：组装上下文 → 调模型 → 有 tool_call 就校验并执行 → 回填观察 → 继续或收敛。终止条件必须由代码兜底：最大步数、总超时、重复 `(tool,args)` 指纹、状态哈希不变、目标槽位齐全、预算耗尽或人工中断。

  * **长任务状态**：任务计划、当前节点、已完成产物引用、错误计数、审批状态和执行代次外置到 DB/状态存储，节点边界写 checkpoint；恢复时从最近已完成节点续跑，副作用按幂等键跳过，不能靠一条无限增长的对话记忆。

* **多轮会话与用户隔离**：

  * 会话表存 `session_id, user_id, topic, active_mem_ver, last_msg_seq, status`；消息表按 `(session_id, msg_seq)` 唯一递增，摘要表按版本保存覆盖区间，长期记忆只存程序性表达偏好与有效事实，不与当轮 Evidence 混写。

  * 同一用户短时间连续消息可做 800ms～2s 聚合防抖，用户新消息到达可取消上一轮生成；所有会话、工具与记忆查询都强制带 `tenant_id/user_id` 过滤，不能只凭自增 session_id 判权限。

#### 3. 项目落地与系统设计权衡

NoteWeave 用静态系统指令、会话持续约束与不可变话题摘要做前缀，工具结果和当轮 Evidence 放动态尾部；Table-as-State 用数据库格子状态替代无限 ReAct 历史。TencentDB 用固定协议、信息缺口门控和会话级工具卡避免前缀抖动。制造业把 LOTO 与审批等不可变约束放在确定性流程中，模型只生成草稿，不让模型自由决定高风险动作。

#### 4. 面试口述与连环追问

> **【面试口述】**Prompt 我会按系统规则、用户请求、检索证据、工具结果四类分区：系统规则保持静态以吃前缀缓存，证据带版本和来源并声明不是指令，工具结果结构化裁剪。Workflow 与 Agent 的边界看路径确定性，能写死的流程用代码编排，只有不确定子任务交给模型。长任务一定外置状态、步数和超时预算，终止条件由代码兜底；多轮会话则把会话、消息、摘要和长期记忆分开存，所有读取都带用户与租户过滤。

* **追问：ReAct 一直重复调用同一个工具，怎么让它停下来，同时不误杀正常重试？**

  > **答**：给 `(tool,args)` 做指纹计数，同名同参第二次仍失败就禁用这条路径并换检索词或换工具，同时设置总步数和墙钟超时；参数发生实质变化不算循环。若是正常网络超时，可按错误类型做一次有上限的退避重试，参数非法、权限拒绝和无新信息观察则直接退出，不让模型自己决定永远重试。



### 6.6 工具选择、MCP 治理、执行沙箱与 Coding Agent 验证

#### 1. 核心定位与常考主线

工具层不是把函数签名贴给模型，而是一套带路由、Schema、权限、预算、超时、幂等与可观测的调用治理体系。Function Calling 负责模型意图，MCP 负责工具供给协议，真正执行与鉴权仍在后端和沙箱。Coding Agent 还必须有编译、测试、静态检查和可回滚的验证闭环，不能把生成文本当成已验证代码。

#### 2. 底层机制与高频考点

* **工具选择与 Function Calling 全链路**：

  1. **是否调用与选哪个**：工具描述写清「何时用 / 何时不用 / 参数含义 / 返回结构」，单轮可见工具控制在 10～20 个；数量更多时先做意图分类或二级路由，再按需加载 Skill 正文，不让模型在几百个工具里盲选。

  2. **参数与执行**：模型只产出函数名和 JSON 参数，宿主按 JSON Schema、枚举、必填和业务权限二次校验，写操作必须带幂等键与最小作用域；不能把幻觉参数直接打到生产库。

  3. **结果与错误分类**：结果只返回结构化数据和必要证据；4xx 参数错允许改参，权限错升级审批，5xx/超时按幂等性退避重试，资源不存在明确 `no result`，避免模型把空结果误当失败反复调用。

* **MCP 与工具编排治理**：

  * MCP 解决 Host 与外部 Server 的能力发现和调用协议，Function Calling 解决模型侧意图表达；API 网关负责流量鉴权、限流与审计，三者不是替代关系。

  * 工具编排要给每跳设置连接/读取超时、总预算、重试上限和降级路径，危险工具支持 dry-run、审批和最小权限；对工具描述与返回做哈希或签名验证，防描述投毒和返回中的间接提示注入。

* **沙箱与可审计执行轨迹**：

  * 文件读写限制在任务工作区，命令白名单、网络域名白名单、资源限额与超时由执行器控制；模型提出动作与执行动作分离，删除、付款、外发等高危动作必须审批。

  * 轨迹记录任务 ID、工具名、脱敏参数哈希、调用方、耗时、结果摘要与审批记录，支持按 checkpoint 回放；重试和恢复必须避免重复副作用。

* **Coding Agent 的正确性判定与合入**：

  * 先按仓库规范搜索定位、读取相关文件与测试，再生成最小变更；验证从「能编译」升级为需求一致、单测/集成测试、Lint/类型检查、性能与安全检查，关键资金/权限链路保留人工审查。

  * 读取—修改—测试—失败回喂形成有限循环，防止无限自修；每次合入带 feature flag、灰度比例与回滚方案，AI 产出不能越过 CI 和发布门禁。

#### 3. 项目落地与系统设计权衡

NoteWeave 将多模态重依赖工具封装成少量 MCP 服务，用预签名 URL 传大文件、服务端校验工具描述；TencentDB 用三层契约提高 Shell + curl 调用准确率，但真正权限由 Bridge 网关按会话令牌强制校验。制造业把模型输出交给 Java 规则与人工审批，而不是直接执行拆修或扣账，体现了「提示词提高正确率、代码守住边界」的分工。

#### 4. 面试口述与连环追问

> **【面试口述】**工具调用我按四层处理：先用描述和路由控制选择范围，再用 Schema 与服务端校验参数，随后由沙箱按权限、预算和超时执行，最后把结构化结果和错误分类回填。Function Calling 管意图、MCP 管工具协议、网关管安全，不能混为一谈。Coding Agent 则必须跑编译、测试、静态检查和回滚验证，模型只是提案者，真正能否合入由验证链路和人工高风险审查决定。

* **追问：工具超时了，能不能直接让模型重试？**

  > **答**：先看工具是否只读幂等、错误是否可重试，以及本次调用剩余预算。只读查询可按一次短退避重试，写操作必须先拿原幂等键查执行状态或走对账，不能无条件重发；参数错误和权限错误直接返回修正或审批，重试也要受总次数和全局超时限制，并记录每次尝试避免重复副作用。



### 6.7 多 Agent 协作、共享记忆与编排框架选型

#### 1. 核心定位与常考主线

多 Agent 的价值是隔离上下文、并行独立子任务和隔离权限，不是简单多几个角色。需要交代任务 DAG、每跳的输入输出契约、共享记忆的写入边界、失败仲裁与成本；框架选择则看控制流是否可显式表达、状态能否持久化、是否支持中断审批与回放。

#### 2. 底层机制与高频考点

* **任务分解与协作拓扑**：

  1. **Supervisor / Planner**：主 Agent 只拆任务、路由和验收，子 Agent 返回结构化结果，适合研究、检索和异构工具并行；主 Agent 不应把所有观察再复述一遍。

  2. **Handoff**：当前 Agent 将任务连同最小必要上下文交给专门角色，适合明确分工的串行流程；移交要有完成条件和权限边界。

  3. **群聊 / 黑板**：多 Agent 通过共享消息或黑板协作，灵活但最容易产生上下文膨胀、互相附和与不可控循环，必须限制轮次、消息结构和仲裁人。

* **上下文与共享记忆**：

  * 子任务只传任务说明、必要证据摘要、输出 Schema 与截止条件，默认不共享完整对话；公共状态写数据库或黑板，私有推理和中间观察留在各自上下文。

  * 共享记忆要分「任务状态、事实证据、程序性规范」三类，写入带来源、版本、租户和有效期，任何子 Agent 都不能把未验证猜测直接写成全局事实。

* **结果仲裁与失败恢复**：

  * 每个子任务必须给完成判据、证据和可机读状态；冲突先查外部证据和版本，不能让同一模型反复投票自洽。部分失败按业务定义是整体回滚、补偿还是降级，并显式告知用户。

  * 调度状态外置 DAG，Leader 故障可由租约和 checkpoint 接管；每步的副作用带幂等键，防止重放重复写。

* **LangChain、LangGraph 与自研状态机**：

  * 单次无环调用和简单组合可用链式抽象；多轮带环、共享状态、条件边、人工中断和 checkpoint 恢复用显式状态图；跨进程并发写和强一致提交仍需数据库行锁、版本或 Fencing Token，框架自身不替代这些约束。

  * 框架选型看状态持久化、工具协议兼容、可观测、多租户、人工干预、模型解耦与二次开发成本，不以「是否最热门」决定。

#### 3. 项目落地与系统设计权衡

NoteWeave 的 Table-as-State 本质上把多 Agent 的公共状态收敛为 MySQL 格子：每个 Worker 只读单格上下文，结果先过确定性与异构 Verifier，再按缺口局部 Replan，避免全局群聊式膨胀。制造业不采用多 Agent 自由协作，而采用固定流水线与人工审批，因为高风险动作更需要可预测的单一责任链。

#### 4. 面试口述与连环追问

> **【面试口述】**多 Agent 我只有在上下文隔离、并行收益或权限边界明确时才引入。主 Agent 负责拆解和验收，子 Agent 只收结构化任务与必要证据，公共状态写数据库，不让所有角色共享完整聊天。冲突用外部证据和版本仲裁，失败按业务选择补偿或降级。LangChain 适合简单链式组合，LangGraph 适合带环状态机，但跨进程写一致性仍要数据库锁和 Fencing Token，不能只靠框架。

* **追问：多 Agent 跑了一阵后为什么经常退化成单 Agent 或固定 Workflow？**

  > **答**：当任务路径逐渐稳定，动态路由的收益小于每多一跳的模型调用、上下文复制和失败概率，工程上就会收敛为 DAG 加少量 Agent 节点。是否保留多 Agent 要用同一评测集比较准确率、P95 延迟和单任务成本，提升不明显就回退，而不是用「更像真人团队」作为架构理由。



### 6.8 Transformer、多模态桥接与推理部署补充

#### 1. 核心定位与常考主线

理解模型底座不是为了背层数，而是为了解释训练稳定性、长上下文成本、视觉信息如何进入语言模型，以及线上显存和并发从哪里来。重点包括残差与归一化、MHA/GQA、FFN、RoPE、视觉编码器与投影桥接，以及 vLLM 的 PagedAttention、Prefix Cache 和 Continuous Batching。

#### 2. 底层机制与高频考点

* **Transformer 结构与训练稳定性**：

  1. **注意力与 FFN 分工**：自注意力负责 token 间信息交换，FFN 负责每个 token 独立的非线性变换；多头让模型在不同子空间学习不同关系，不能简单退化为单头，否则特征表达和位置组合能力下降。

  2. **Pre-LN 与 Post-LN**：Pre-LN 将归一化放在子层输入前，残差通道更直接，深层梯度和训练更稳定；Post-LN 将归一化放在残差相加后，早期归一化更直观但深层更容易出现梯度波动。LayerNorm 按特征维归一化，区别于 BatchNorm 按批统计。

  3. **复杂度与位置编码**：标准全注意力随序列长度呈 `O(L²)` 计算与注意力矩阵开销；RoPE 通过旋转位置编码让内积包含相对位置信息，但长窗口仍需面对 KV Cache 与有效记忆衰减，不能把窗口长度等同于真实记忆能力。

* **多模态视觉桥接与视频抽帧**：

  * 常见链路是视觉编码器提取 patch/frame 特征，再用投影层或 Q-Former 将视觉空间映射到语言模型的 Token 空间；早融合更利于细粒度交互但序列成本高，晚融合模块解耦更强但跨模态细节较少，Cross-Attention 门控用于选择何时读取视觉信息。

  * 视频接入要保留真实 PTS 时间戳和采样策略，关键帧去重可用感知哈希；不能把所有帧无差别塞进上下文，应该按场景做稀疏全片抽样与局部高分辨率补抽，并记录证据时间范围。

* **推理部署与调度**：

  * Prefill 更受算力限制，Decode 更受显存带宽与 KV Cache 容量限制；PagedAttention 将 KV Cache 按非连续页块管理降低碎片，Prefix Cache 复用相同前缀的 KV，Continuous Batching 在每个生成步踢出完成请求并补入新请求，避免整批等待最长序列。

  * 线上容量要同时估算权重、KV Cache、激活值和等待队列；`gpu_cache_usage_perc` 接近满载会触发 Preemption 换出重算，表现为尾延迟突然放大，不能只看平均吞吐。

#### 3. 项目落地与系统设计权衡

制造业单卡 A800 的并发上限是按模型权重、GQA KV Cache 与 16k 上下文逐路估算后确定的，而不是照抄通用 QPS；NoteWeave 对视频 MCP 按 PTS 做稀疏抽帧和 pHash 去重，减少无关视觉 Token；长会话仍用检索和状态外置补足模型记忆，不把扩大窗口当成唯一方案。

#### 4. 面试口述与连环追问

> **【面试口述】**Transformer 里注意力负责跨 token 交换信息，FFN 做单 token 非线性变换，Pre-LN 让深层训练更稳定，RoPE 提供相对位置信息，但全注意力仍有 O(L²) 成本。多模态通常由视觉编码器加投影或 Q-Former 接入语言模型，视频要按 PTS 抽样去重控制 Token。部署上 Prefill 看算力、Decode 看显存带宽和 KV Cache，PagedAttention 管碎片，Prefix Cache 复用前缀，Continuous Batching 消除整批等待，最终容量仍要按权重和 KV Cache 实算。

* **追问：为什么 KV Cache 快满了以后，系统不是简单变慢一点，而是 P99 突然飙升？**

  > **答**：KV Cache 接近上限后，vLLM 需要暂停部分请求、换出或重算其 KV 状态，后续还要重新加载和计算，形成抢占与排队放大；新请求又持续进入时，等待队列会进一步拉长，所以尾延迟会阶跃上升。处理上应限制并发和上下文长度、提高前缀复用、使用 GQA/量化或扩容，不能只调大 batch。



## 七、项目同名高频工程手撕（五大并发与算法模板）

这 5 道工程手撕题直接对应三段项目的核心组件，重点考察数据结构不变量、并发安全与边界防御。

### 7.1 手撕一：`O(1)` `LRUCache`（哈希表 + 双向哨兵链表）及并发演进

* **项目锚点**：顺接 MySQL InnoDB `Buffer Pool` `5:3` 冷热隔离 LRU、Redis 淘汰策略与本地 Caffeine `W-TinyLFU` 对比。

* **核心题眼**：① 设 `head / tail` 虚拟头尾哨兵节点消除一切 `null` 指针特判；② `Node` 必须同时存 `key` 和 `val`，否则淘汰链表尾部 `tail.prev` 时无法 `O(1)` 反查 `HashMap` 删除对应键；③ 追问线程安全版怎么改：读多写少套 `StampedLock / ReentrantReadWriteLock` 仍有移动链表写锁竞争，高并发生产环境模仿 Caffeine 用 `ConcurrentHashMap` + 环形缓冲区（RingBuffer）异步批放访问日志减少锁争用。时间 `O(1)`，空间 `O(C)`。

```java
import java.util.*;

public class LRUCache {
  private static class Node {
    int key, val;
    Node prev, next;
    Node(int k, int v) { key = k; val = v; }
  }

  private final int cap;
  private final Map<Integer, Node> map;
  private final Node head = new Node(0, 0), tail = new Node(0, 0);

  public LRUCache(int capacity) {
    this.cap = capacity;
    this.map = new HashMap<>(capacity * 2);
    head.next = tail;
    tail.prev = head;
  }

  public int get(int key) {
    Node n = map.get(key);
    if (n == null) { return -1; }
    moveToHead(n);
    return n.val;
  }

  public void put(int key, int value) {
    Node n = map.get(key);
    if (n == null) {
      Node c = new Node(key, value);
      map.put(key, c);
      addFirst(c);
      if (map.size() > cap) {
        Node old = tail.prev;
        unlink(old);
        map.remove(old.key);
      }
    } else {
      n.val = value;
      moveToHead(n);
    }
  }

  private void addFirst(Node n) {
    n.prev = head;
    n.next = head.next;
    head.next.prev = n;
    head.next = n;
  }

  private void unlink(Node n) {
    n.prev.next = n.next;
    n.next.prev = n.prev;
  }

  private void moveToHead(Node n) {
    unlink(n);
    addFirst(n);
  }
}
```

### 7.2 手撕二：多路加权保序去重 `RRF` 融合器（`RrfFuser`）

* **项目锚点**：直接对应 NoteWeave 双路（`BM25 + Vector`）与制造业三路（`故障编码 + 全文 + 向量`）`RRF(k=60)` 融合代码实现。

* **核心题眼**：① **单路内部用 `HashSet` 先去重且跳过重复项不递增 `rank`**，防止某路脏数据重复吐出同一 `docId` 刷双倍分；② 排序出现平分时，依次按最高单路名次 `bestRank` 升序、`docId` 字典序确定性决胜（Tie-breaking），保障评测回归结果完全可复现。时间 `O(M + U log U)`，空间 `O(U)`。

```java
import java.util.*;

public class RrfFuser {
  public record RankedList(List<String> docIds, double weight) {}
  public record FusedDoc(String docId, double rrfScore, int bestRank) {}

  private static class Acc {
    double score = 0.0;
    int bestRank = Integer.MAX_VALUE;
  }

  public static List<FusedDoc> fuse(List<RankedList> lists, int k, int topN) {
    if (k <= 0 || topN <= 0 || lists == null || lists.isEmpty()) { return List.of(); }
    Map<String, Acc> table = new HashMap<>();
    for (RankedList r : lists) {
      if (r == null || r.docIds() == null || r.weight() <= 0.0) { continue; }
      Set<String> seen = new HashSet<>();
      int rank = 0;
      for (String id : r.docIds()) {
        if (id == null || !seen.add(id)) { continue; }
        rank++;
        Acc a = table.computeIfAbsent(id, x -> new Acc());
        a.score += r.weight() / (k + rank);
        if (rank < a.bestRank) { a.bestRank = rank; }
      }
    }
    List<FusedDoc> res = new ArrayList<>(table.size());
    table.forEach((id, a) -> res.add(new FusedDoc(id, a.score, a.bestRank)));
    res.sort(Comparator.comparingDouble(FusedDoc::rrfScore).reversed()
        .thenComparingInt(FusedDoc::bestRank)
        .thenComparing(FusedDoc::docId));
    return res.size() <= topN ? res : new ArrayList<>(res.subList(0, topN));
  }
}
```

### 7.3 手撕三：带并发配额与 Kahn 环检测的非阻塞 `DAG` 调度器

* **项目锚点**：融合 NoteWeave `Table-as-State` 动态拆格依赖环检测（Kahn BFS）+ 工作区并发配额控制 + 防 `CompletableFuture` 父子同池阻塞死锁。

* **核心题眼**：① 启动前先跑一遍 Kahn 入度归零 BFS，若访问节点数 `< nodes.size()` 立即返回失败 Future 拦截环依赖；② **全程无任何工作线程阻塞等待前驱任务**——只有入度减到 `0` 的就绪节点才提交线程池，完单回调里用 `AtomicInteger.decrementAndGet()` 原子触发后继节点派发，彻底杜绝线程池饥饿死锁；③ `Semaphore` 控制最大并发度，捕获 `InterruptedException` 立即恢复线程中断标志位并通过 `AtomicBoolean` 短路整张图。时间 `O(V + E)`。

```python
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Function;

public class DagQuotaScheduler {
  public record DagNode<R>(String id, List<String> deps, Function<Map<String, R>, R> action) {}

  public static <R> CompletableFuture<Map<String, R>> executeDag(
      List<DagNode<R>> nodes, int maxConcurrency, ExecutorService pool) {
    if (nodes == null || nodes.isEmpty()) { return CompletableFuture.completedFuture(Map.of()); }
    Map<String, DagNode<R>> nodeMap = new HashMap<>();
    Map<String, List<String>> children = new HashMap<>();
    Map<String, Integer> inDeg = new HashMap<>();
    for (DagNode<R> n : nodes) {
      nodeMap.put(n.id(), n);
      children.put(n.id(), new ArrayList<>());
      inDeg.put(n.id(), 0);
    }
    for (DagNode<R> n : nodes) {
      for (String d : n.deps()) {
        if (!nodeMap.containsKey(d)) { throw new IllegalArgumentException("Missing dep: " + d); }
        children.get(d).add(n.id());
        inDeg.put(n.id(), inDeg.get(n.id()) + 1);
      }
    }
    Deque<String> bfs = new ArrayDeque<>();
    Map<String, Integer> chk = new HashMap<>(inDeg);
    chk.forEach((k, v) -> { if (v == 0) { bfs.addLast(k); } });
    int vis = 0;
    while (!bfs.isEmpty()) {
      String cur = bfs.removeFirst();
      vis++;
      for (String nxt : children.get(cur)) {
        if (chk.merge(nxt, -1, Integer::sum) == 0) { bfs.addLast(nxt); }
      }
    }
    if (vis < nodes.size()) {
      return CompletableFuture.failedFuture(new IllegalStateException("Cycle detected"));
    }

    Map<String, AtomicInteger> liveDeg = new ConcurrentHashMap<>();
    inDeg.forEach((k, v) -> liveDeg.put(k, new AtomicInteger(v)));
    Map<String, R> res = new ConcurrentHashMap<>();
    AtomicInteger rem = new AtomicInteger(nodes.size());
    AtomicBoolean aborted = new AtomicBoolean(false);
    Semaphore quota = new Semaphore(maxConcurrency);
    CompletableFuture<Map<String, R>> done = new CompletableFuture<>();

    class Runner {
      void dispatch(String id) {
        CompletableFuture.runAsync(() -> {
          if (aborted.get()) { return; }
          boolean held = false;
          try {
            quota.acquire();
            held = true;
            if (aborted.get()) { return; }
            res.put(id, nodeMap.get(id).action().apply(Collections.unmodifiableMap(res)));
          } catch (Throwable ex) {
            if (ex instanceof InterruptedException) { Thread.currentThread().interrupt(); }
            if (aborted.compareAndSet(false, true)) { done.completeExceptionally(ex); }
            return;
          } finally {
            if (held) { quota.release(); }
          }
          if (rem.decrementAndGet() == 0 && !aborted.get()) {
            done.complete(Collections.unmodifiableMap(res));
            return;
          }
          for (String ch : children.get(id)) {
            if (liveDeg.get(ch).decrementAndGet() == 0 && !aborted.get()) { dispatch(ch); }
          }
        }, pool);
      }
    }
    Runner r = new Runner();
    inDeg.forEach((k, v) -> { if (v == 0) { r.dispatch(k); } });
    return done;
  }
}
```

### 7.4 手撕四：带 `Semaphore` 并发闸门与超时降级帧的 `SSE` 流式守卫

* **项目锚点**：对应 NoteWeave Python 异步模型流式网关，区分「排队拿并发槽超时（`TTFT` 前保护）」与「生成中途单步吐词卡死超时（`TPOT` 保护）」。

* **核心题眼**：① 只捕获 `Exception` 而**绝不吞掉继承自 `BaseException` 的 `asyncio.CancelledError`**，确保前端客户端中途关闭网页断连时协程能立刻沿 `finally` 归还信号量配额，绝不泄漏并发槽；② 发生排队繁忙或中途卡顿时优雅吐出结构化 `event: fallback` 降级帧通知前端，避免半截乱码。

```java
import asyncio
import json
from collections.abc import AsyncIterator, Callable

def sse_frame(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

class SseStreamGuard:
    def __init__(self, max_concurrency: int, acquire_timeout: float, chunk_timeout: float) -> None:
        self._sem = asyncio.Semaphore(max_concurrency)
        self._acquire_timeout = acquire_timeout
        self._chunk_timeout = chunk_timeout

    async def stream_with_fallback(
        self, request_id: str, upstream_factory: Callable[[], AsyncIterator[str]]
    ) -> AsyncIterator[str]:
        acquired = False
        try:
            await asyncio.wait_for(self._sem.acquire(), timeout=self._acquire_timeout)
            acquired = True
        except TimeoutError:
            yield sse_frame("fallback", {"request_id": request_id, "reason": "quota_busy"})
            return
        try:
            aiter = upstream_factory().__aiter__()
            while True:
                try:
                    chunk = await asyncio.wait_for(anext(aiter), timeout=self._chunk_timeout)
                except StopAsyncIteration:
                    break
                yield sse_frame("delta", {"request_id": request_id, "text": chunk})
            yield sse_frame("done", {"request_id": request_id, "finish_reason": "stop"})
        except TimeoutError:
            yield sse_frame("fallback", {"request_id": request_id, "reason": "chunk_timeout"})
        except Exception as exc:
            yield sse_frame("fallback", {"request_id": request_id, "reason": str(exc)})
        finally:
            if acquired:
                self._sem.release()
```

### 7.5 手撕五：冻结稳定请求号与 `4xx / 429 / 5xx` 全抖动幂等重试器

* **项目锚点**：对应制造业外部网关/工单调用——首次发起前冻结唯一 `frozenRequestNo` 全程重传不变，区分可重试与不可重试错误码，叠加指数退避与 `Full Jitter` 防重试惊群。

* **核心题眼**：① **`frozenRequestNo` 在循环外生成一次并跨所有 `attempt` 透传**，绝不在 `for` 循环里每次 `UUID.randomUUID()`；② `400 / 401 / 403 / 422` 等确定性客户端参数/鉴权错误立即失败不浪费配额，仅重试 `429`（优先服从服务端返回的 `Retry-After`）与 `5xx`/网络异常；③ `Full Jitter` 在 `[0, min(maxMs, base * 2^attempt)]` 均匀随机打散重试洪峰（位运算 `Math.min(attempt, 20)` 防左移整数溢出变负数）。

```java
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

public class IdempotentRetryExecutor {
  public record HttpResult(int statusCode, String body, long retryAfterMs) {}

  @FunctionalInterface
  public interface IdempotentCall {
    HttpResult invoke(String frozenRequestNo, int attempt) throws Exception;
  }

  public static HttpResult executeWithRetry(
      IdempotentCall call, int maxRetries, long baseMs, long maxMs) throws Exception {
    final String frozenRequestNo = UUID.randomUUID().toString();
    Exception lastEx = null;
    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      long waitMs = 0L;
      try {
        HttpResult resp = call.invoke(frozenRequestNo, attempt);
        int code = resp.statusCode();
        if (code >= 200 && code < 300) { return resp; }
        if (code == 429 || code >= 500) {
          waitMs = resp.retryAfterMs() > 0
              ? Math.min(resp.retryAfterMs(), maxMs)
              : jitterMs(attempt, baseMs, maxMs);
        } else {
          throw new IllegalArgumentException("Non-retryable 4xx: " + code);
        }
      } catch (IllegalArgumentException bad) {
        throw bad;
      } catch (Exception ex) {
        lastEx = ex;
        waitMs = jitterMs(attempt, baseMs, maxMs);
      }
      if (attempt == maxRetries) { break; }
      try {
        Thread.sleep(waitMs);
      } catch (InterruptedException ie) {
        Thread.currentThread().interrupt();
        throw ie;
      }
    }
    if (lastEx == null) { throw new IllegalStateException("Exhausted: " + frozenRequestNo); }
    throw lastEx;
  }

  private static long jitterMs(int attempt, long baseMs, long maxMs) {
    long cap = Math.min(maxMs, baseMs * (1L << Math.min(attempt, 20)));
    return ThreadLocalRandom.current().nextLong(cap + 1L);
  }
}
```

## 附录：项目全量量化指标与实验口径速查表

每项量化结果都对应明确的分子分母、基线对照组与防刷分实验口径，追问数据来源时按以下四要素直接展开：

| 所属经历 | 简历原文指标 | 精确分子 / 分母与对照组 | 实验场景与防刷分硬核依据 | 
| ----- | ----- | ----- | ----- | 
| **NoteWeave** | **有效研究单元完成率 `67% → 83%`** | `94 / 140 → 120 / 145`（对比 `59/68`、综述 `33/37`、事实 `16/19`、冲突 `12/21`） | 20 道冻结公开技术研究题微平均；对比题核实体覆盖率 + 异构模型 3 次多数投票核 3 要点防少拆格刷分 | 
| **NoteWeave** | **检索离线 `Recall@10`（口述补充）** | 纯向量 `0.66` → 双路 RRF `0.81` → 加重排 **`0.87`**（`MRR: 0.51 → 0.78`） | 40 道冻结检索题中的单轮 20 题（专有名词 `0.48 → 0.93`）；单机 18 万切片 `20 QPS` 稳态 `P95 ≈ 180ms`（主库复核 `1～2ms`） | 
| **NoteWeave** | **平均输入 Token 降低 `34%`** | 主模型单轮 `prompt_tokens` 均值 **`9,860 → 6,510`** | 30 段跨话题多轮长会话（每段 20～32 轮，共 780 轮，意图 Top-1 `726/780 ≈ 93%`），同为 `16k` 预算上限对照全量历史回放 | 
| **NoteWeave** | **关键事实检查通过率 `92%`** | 分层编译 **`230 / 250`** vs 全量回放基线 **`222 / 250（89%）`** | 预埋 250 个检查点：跨轮约束 `82 vs 84 / 90`、指代 `77 vs 76 / 80`、早期细节 **`71 vs 62 / 80`**（全量超 16k 截断最早消息丢分） | 
| **NoteWeave** | **`128 MB` 单文件异步接入 & 续读** | `-Xms512m -Xmx512m` 跑 `8 路 × 128 MB` 并发上传 GC 日志未观测到巨型对象引发的 Full GC | `8 MB` 分片直传 MinIO + `8 KB` 流式验魔数/SHA-256；断网/切网关/超窗三类故障注入后前端全文与终态全文逐字一致 | 
| **制造业平台** | **`5,000` 余条全部最终发布、未观测到重复** | 演练共 **`5,200` 条**：发布账 `4,890 实时 + 310 断网90s补发`；发送账 `5,150 一次 + 12 强杀 + 38 对账` | `tc netem` 丢包 + 断连 MQ `90s` + 高峰 3 次 `kill -9`；模拟网关按唯一 `request_no` 核对流水重复数为 `0` | 
| **制造业平台** | **中断任务约 `10s` 内被接管** | 3 次 `kill -9` 截获 `4 + 5 + 3 = 12` 条在途单，**最快 `8.2s`、平均 `8.9s`、最慢 `9.6s`** | 单机在途上限 `4 短信 + 2 语音 = 6 路`；依托 `8s` 行级租约 + `1s` 固定延迟扫描（从强杀时刻算平均约 `7.1s`） | 
| **制造业平台** | **普通重复提醒量减少约 `60%`** | 普通催办 **`11,400 → 4,520` 条（`-60.4%`）** | 连续 2 周真实历史事件流回放（含 6 次 `3,000 条/2min` 补报洪峰），首次/升级/恢复三类关键通知条数前后完全一致 | 
| **制造业平台** | **`P0/P1` 时限内通道受理率 `99%` 以上** | **`1,193 / 1,200 = 99.4%`**（P0 ≤ `2min`、P1 ≤ `5min` 拿网关受理凭据） | 叠加洪峰、Sentinel 切主与 `429`；7 条 P0 短信撞三重窗口约 `130s` 对账受理，但 `T+0` 预埋的 `+60s` 独立语音单全部第 `60s` 准时呼通 | 
| **制造业平台** | **离线评估 `Hit@6` 约 `85%`** | **`153 / 180 = 85.0%`**（故障码 `76/80`、口语 `31→46/60`、改款 `31/40`） | 200 题（180 有解 + 20 超纲全拦），按告警触发时刻可见批次截断修复时间穿越（防穿越前虚高为 `165/180 ≈ 91.7%`） | 
| **制造业平台** | **引用支持率约 `95%`** | `156` 张放行卡（`148 命中放行 + 8 基础SOP放行`）共 `390` 处引用中 **`371` 处获支撑（`95.1%`）** | 2×2 四格表严丝合缝咬合 `153 Hit@6` 与 `156 放行卡`（误拒 `5+19=24` 道），其余 19 条归入待现场核实项 | 
| **制造业平台** | **现场人员定位故障耗时中位数下降约 `35%`** | 对照组 `62` 起 **`20.5 min`** → 实验组 `64` 起 **`13.2 min`（`-35.6%`）** | 同车间两条同构产线、甲乙两班组 4 周按周交叉轮换，取 CMMS 扫码签到至提交故障原因两个硬时间戳 P50 | 
| **制造业平台** | **草稿生成端到端 `P95` 由约 `40s` 降至约 `15s`** | 2×2 正交对照：**`40.4s`（串行长事务）→ `15.2s`（`3/3/6` 并发 + 三阶段双短事务）** | 单实例 3 线程跑 40 批 × 每批 5 单 = 200 份取第 190 名（分 3+2 两波跑完，单单约 `7.2～8.8s`），每批跑完再投下一批，单份占 DB 连接约 **`25ms`**（草稿约 `0.01` 条、叠加诊断约 `0.02` 条） | 
| **制造业平台** | **一次审批通过率约 `80%`** | **`93 / 115 = 80.9%`**（试运行 `63` 份 + 产线灰度拆修 `52` 份） | 班组长未改故障定性、LOTO 安全前提、核心拆装步骤与子 BOM 备件编码即批准（未过 22 份含 9 缺货换件 + 5 选配主轴/部件子 BOM 微调等） | 
| **TencentDB** | **误调用率由 `87.14%` 降至 `31.94%`** | 有效负例 `FCR`：**`122 / 140 → 46 / 144`（净降 `55.20pp`）** | `Codex CLI` 跑 `test1k` 前 `250` 条受控对照（有效样本 `242` vs `248`）；主动交代正例发出率 `ECR: 96.08% (98/102) → 77.88% (81/104)` 权衡 | 
| **TencentDB** | **首步命中率由 `27.55%` 提升至 `74.07%`** | 条件口径 `TSR_cond`：**`27 / 98 → 60 / 81`**；全量口径 `TSR_all`：**`26.47% (27/102) → 57.69% (60/104)`** | 满足恒等式 `TSR_all = ECR × TSR_cond`，自证真实首步命中数从 27 翻倍至 60，未靠缩分母刷高指标 | 
| **TencentDB** | **必要链完成率由 `25.49%` 提升至 `55.77%`** | `Complete (CCR)`：**`26 / 102 → 58 / 104`**（`Strict: 15.69% → 19.23%`） | 盲目未完链试探 `72/102 → 23/104` 暴降超 2/3；多跳救活后求稳多查一步呈 Simpson 难度迁移效应（`10/26 → 38/58`） | 
| **TencentDB** | **工具说明 Token 压缩 `27.02%`** | `o200k_base` 均值 **`3,518.0 → 2,567.5 Token`**（`N=250`） | 三层运行时契约编译器 + 会话级裁剪 + 五段静态前缀置顶，配套 `7` 文件 `183` 项单测（含负向断言防漏删安全约束） | 
