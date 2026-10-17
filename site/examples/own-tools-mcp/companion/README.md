# 可运行伴随工程

本地教学工程，主入口为 `bash run-all.sh`。在本目录执行。需要 JDK 21、Python 3.11+、Bash；验证环境为 OpenJDK 21.0.12.1、Python 3.12.14。H2 2.3.232 的未修改 jar 已包含并校验 SHA-256。没有 Maven、pip、模型密钥或在线服务依赖。

## 文件与命令

- `java/src/interview/tools/ToolPort.java`：工具层适配器合同。
- `ToolExecutor.java`、`StrictJson.java`、`Cleanup.java`：有界执行、严格 JSON、独立清理。
- `ToolExecutorTest.java`：本地故障与竞争测试。
- `DemoBackend.java`：版本 CAS、完整大结果分页取回、内容哈希与租户隔离的内存后端。该 ASCII 产物示例按字符偏移分页，不是通用 Unicode 游标服务。
- `ModernMcp.java`：Java 的有限 tools-only stdio Server。
- `McpInteropTest.java`：Java Host 启动 Python Server 并核验真实响应。
- `McpResponseGuard.java`：有限现代响应合同与错 ID、缺必需字段等负例。
- `python/agent_runtime_demo.py`：完整 Python 协作式运行时与十三项测试。
- `legacy/ToolWrapper.java`：已解码 Map 的轻量方案；不是 JSON 解析器。
- `legacy/OperationRecovery.java`：H2 日志与真实无害子进程，必须使用新的数据库及回执路径。
- `legacy/FieldPlan.java`、`FieldPlanTest.java`：受限语法与 JDBC 绑定测试。
- `mcp/modern_server.py`、`test_modern.py`：Python Server 和双语言协议测试。
- `mcp/dynamic_server.py`、`test_dynamic.py`：SQLite 发布配置、同进程刷新与实际回调。
- `mcp/http_contract.py`：HTTP 元数据纯函数夹具，不启动 HTTP 服务。
- `fixtures/legacy-2025-11-25.json`：独立旧式 initialize 对照。

编译后的类输出到 `java/classes`，运行日志到 `logs/latest.log`；持久化恢复例子的数据库和回执保留在每次新建的 `work/recovery-*` 目录。脚本不会删除已有数据。Windows 可使用 WSL，其他方式需要改写 Bash 命令和 classpath 分隔符。

## Java ToolPort 的精确语义

`invoke(Context, Call, Budget)` 返回 Reply，不通过未分类的中断异常隐藏写入不确定性。Context 由宿主从可信认证与当前授权构建；capabilities 不能来自模型。Call 的 callId 关联此次请求；operationId 关联原业务操作。写操作要求非空 operationId。

前置回调合同：业务 Validator 及入队/重放前的 Authorizer 在 invoke 调用线程同步运行，必须是可信、本地、有界且非阻塞代码。Budget 的 deadline 和 cancellation 不会抢占或强制限制这些回调的等待；违反前提时，invoke 可能超过期限或不能及时返回。声明此前提不是运行时强制措施，也不解决任意不合作回调。远程策略查询须在自身有超时和失败时拒绝策略的受限适配层完成；当前权限仍须在实际资源事务边界落实。worker 内也会再次调用 Authorizer，调用方停止等待不证明该 callback/worker 已结束。

Reply 的 `effectUncertain` 当且仅当 `status == UNKNOWN`。UNKNOWN 必须携带 operationId。写操作一旦可能开始，等待超时、取消、中断或未知执行失败均不能宣称回滚。中断返回后恢复线程中断标记。只读请求可返回 CANCELLED/DEADLINE_EXCEEDED，但实际工作线程是否停止仍取决于合作。

Budget 是本 JVM 单调时钟截止点、共享原子尝试次数和取消标记。raw 截止点限当前时刻前后一天；推荐 `Budget.after`。nanoTime 不跨进程传输。每次提交预留一个次数，拒绝提交也消耗该预留；无下溢。只有只读且明确标记可重试的失败，才在同一预算中有限重试。写操作不自动重试。

变更日志按 tenant/user/resourceScope/tool/operationId 索引，比较按 key 排序的 JSON 载荷和工具版本。此规范化不是 RFC 8785 通用实现；数字表示按本地解析合同保留。先做当前授权再重放；实际 worker 开始前再次授权。业务服务还要在真正修改资源的事务边界落实授权与 CAS。

日志有容量上限、不自动淘汰，满后拒绝新写入。它是易失内存记录，不提供崩溃恢复。UNKNOWN 保留并阻止盲重放；没有对账接口自动改写终态。`OperationRecovery` 展示另一层持久状态，但没有消除任意外部效果的启动/提交崩溃窗口。

StrictJson 限制 8192 字节、深度 16、节点 512、数组 256、字符串 4096；拒绝重复键、非法 Unicode 和非有限值。它是语法解析器，不是通用 JSON Schema 引擎。业务 Validator 是每个工具的可信代码。Output 限制累积 UTF-8 字节；最终 JSON 校验还会拒绝非法 surrogate。handler 自己提前分配的大对象不受 Output 限制。

close 尝试关闭拥有的执行池，逐个取消排队任务，并在五秒内等待终止；保留失败与中断。这个期限限制等待，不是强制杀线程的保证。不合作的线程可能继续占用 JVM，需外部隔离。不要把宿主共享 executor 传给一个无权关闭它的组件。

## MCP 2026-07-28 有限剖面

支持：UTF-8 换行帧、逐请求必需元数据、server/discover、tools/list、tools/call、版本错误、请求关联、结果类型、TTL/cacheScope、text 与 structuredContent。固定一个有界、无副作用的 sum 工具。数学整数可写为 1 或 1.0，bool 不被接受为整数。Python 对十进制和指数词法先按 Decimal 精确解析，再判断是否为数学整数，不能先转二进制浮点后接受被舍入的小数。此有限剖面的数值请求 id 与 progressToken 限有符号 64 位整数；超界整数可能在 Java 的有界解析层或 Python 的字段校验层被拒绝，二者都不执行工具。字符串标识仍受帧与字符串长度上限约束。

边界：单帧最多 8192 字节，单进程最多 128 帧；解析复杂度有界；目录只有一页，不发 cursor。服务顺序执行微小算术，在读取取消通知时没有仍在运行的算术任务；不声称长任务取消支持。无需客户端可选能力，不发送反向请求、MRTR 或订阅通知。未实现 HTTP、OAuth、资源、Prompt、分页、多模态、进度、扩展与第三方 SDK。任何兼容结论仅针对交付的这一剖面与测试。

Java Host 验证的子进程是本工程自己的 Python 代码，启动参数不来自模型。stdout/stderr 分开、并发、有界读取，输入关闭后等待，必要时终止，再检查结束。不是任意程序执行沙箱。

动态示例使用 SQLite 的单行版本发布合同。每次请求重新读取完整行并校验，候选非法则保留上一有效快照。适配器名仅允许 bounded_sum；同版本变内容拒绝，回滚内容须通过新的递增发布版本。当前实现仅本地单进程、只读工具，无用户认证，无跨节点发布/回滚协调。配置发布本身由测试代码控制，不向模型开放。

HTTP 夹具验证 header/body 对应、Base64 sentinel、防 header 注入、annotation 静态路径/类型/唯一性、版本错误等。它使用较严格的精确文本比较，不演示规范建议的整数 header 数值归一化，也不演示 Accept、Origin、TLS、HTTP 状态管线、SSE 解析或 OAuth。因此它不能用于声称完整 HTTP 兼容。

## Python 运行时边界

`agent_runtime_demo.py` 使用合作式 asyncio handler、内存 ledger 和内存产物，适合学习与回归；不是沙箱、持久任务系统或完整 MCP Server。wait_for 可能等待取消完成而超过名义超时。父取消会传播取消异常，上层对已经开始的写操作仍需保存 UNKNOWN/操作查询语义，不能把取消当成没有副作用的证明。

## 验证层级

run-all 的成功证明这些本地合同和故障用例运行，不证明 NoteWeave、Dify、Spring AI、真实 OAuth 服务、真实 MySQL 或云业务系统集成成功。工程不运行任何原项目仓库代码，不发网络请求，也不进行外部写入。
