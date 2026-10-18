# 执行接管局部实验

在 Linux 或 macOS 的可信本地目录解压，使用 Python 3 和完整 JDK 21 或更高版本运行：

    python3 run_tests.py

如 java 不在 PATH，先把 JAVA_HOME 指向 JDK。运行器使用 JDK 自带 jdk.compiler，编译目标为 Java 21；不下载依赖。每次在此目录下建立临时工作目录，完成后自动移除。独立 Java worker、loopback HTTP、进程终止/重启与文件锁探测都在本机进行；没有公网或远程沙箱。

## 文件与合同

- ScriptControl.java：内存 UNKNOWN/核对模型，30 线程竞争领取。没有持久化、网络或真正脚本执行。
- StrictJson.java、DurableFile.java、ScriptService.java：有界 JSON、本地文件锁/快照、loopback HTTP 的单权威协调器。仅运行 upper-v1 与 sum-v1 两个纯函数，不接受 shell/eval/提交源码。
- ScriptCoreTests.java、CrashWorker.java、LockLifecycleTests.java、http_integration.py：控制面、故障 worker、文件锁生命周期和 HTTP/多 JVM 测试。
- fence-032.sh、fence-033.sh、fence-034.sh：命令片段，含示例目录及端口占位；不要当作通用自动脚本。用上面的运行器复跑。
- source-sha256.json：11 个实现与测试代码块的 SHA-256；run_tests.py 是启动包装，单独记录其版本。

## 精确限制

所有 HTTP 接口 POST，Content-Type 精确为 application/json，请求体最多8192字节，只绑定127.0.0.1。/submit、/claim、/complete、/get 的字段见页面与 ScriptService；不提供取消、续租、任意脚本、认证或TLS。128任务（终态计数）、3次领取、租约最多1000ms且不越deadline；ttlMillis为100到60000。upper-v1输入最多512个UTF-8字节，sum-v1最多256个[-10^9,10^9]整数。完成收据最多4096个UTF-8字节。解析器最多1,048,576字节、64层、50,000节点，数字最多128字符且scale绝对值不超过1000。

文件锁要求合作进程、同一规范账本路径、唯一加载的DurableFile类；不能跨主机，也不能对抗恶意本机进程。不得改删锁文件或创建跨进程硬链接别名。原子覆盖须由目标文件系统支持，没有非原子降级。force不等于目录fsync；没有断电、磁盘损坏、复制或灾备保证。不得暴露到公网或不可信本地环境。没有服务端读取超时及完整拒绝服务防护。

## 如何解读测试

测试分别输出 ScriptControl 的条件检查、47条控制面断言、251条文件锁检查和40条HTTP/进程断言。数字是这个版本的测试集合；只有自己的整次运行成功及退出码0，才能称该次运行通过。文件系统不支持符号链接/硬链接/原子替换时应报告失败或未测，不能假定通过。测试用例不穷尽调度交错、任意崩溃时点、断电、多机网络分区或沙箱逃逸；不证明生产或任意代码隔离安全。
