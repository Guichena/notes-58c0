# 有界线程池练习

需要现有 Java 21 或以上完整 JDK；Python 3 运行器无需第三方包。解压后，在本目录执行：

    python3 run_tests.py

Windows 可使用 `python run_tests.py`。运行器优先使用 JAVA_HOME 下的 java，否则使用 PATH 中的 java。直接通过 jdk.compiler 模块编译，无需单独的 javac 命令。编译及每个 Java 测试进程的等待上限为 30 秒，测试内部还有更短的等待上限；临时编译目录在结束时清理。没有网络请求、依赖下载或真实服务。

不使用 Python 时，将四个 .java 文件放到同一目录，执行：

    java -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -encoding UTF-8 -d out Checks.java BoundedPoolTeaching.java BoundedPoolStartupTest.java BoundedPoolContractTest.java
    java -cp out BoundedPoolStartupTest
    java -cp out BoundedPoolContractTest

运行器成功时输出 Bounded-pool tests passed.。任一步非零退出、超时或成功标记缺失都不能算通过。

## 文件与约定

- BoundedPoolTeaching.java：固定 worker、有界等待队列、显式拒绝、FutureTask 结果、关闭排空、请求立即停止、限时等待。
- Checks.java：运行器所需的有限等待断言辅助类。
- BoundedPoolStartupTest.java：登记、启动前及启动后受控失败；复用饱和、关闭、异常隔离和中断复位检查。
- BoundedPoolContractTest.java：忽略中断导致 awaitTermination 返回 false；出队后尚未进入 Callable 时的所有权竞态；Java ThreadPoolExecutor 的 core/queue/max、CallerRuns 和排队 Future 收尾。

出队竞态用测试专用 FutureTask 包装，在真实 worker 出队后、Callable 开始前用门闩暂停；为装入包装，测试反射访问教学池的 gate 和 queue，并始终在同一 gate 内操作。它不改变教学池源码，也不是生产可扩展接口。其他测试用公开方法及包内测试访问器。测试刻意忽略中断的任务都有测试拥有者控制的退出门闩，不使用 sleep 猜测交错，不制造真实 OOM。

## 实现边界

本池的 shutdownNow 主动取消排队 Future。标准 ThreadPoolExecutor 返回排队 Runnable，不保证自动取消其中的 Future，调用方需承担结果收尾。已出队任务归 worker，即使 Callable 尚未执行，也可能不在返回列表中，并可能在 STOP 后开始执行。中断是合作请求；任务可以忽略它。必须检查 awaitTermination 的 false；测试还会 join 验证实际线程退出。

Startup 只供包内测试，start 必须正常启动，或在真正启动前抛错。真实 VM 崩溃、不可恢复资源耗尽、interrupt 自身失败不在恢复承诺内。没有动态扩缩容、线程工厂配置、业务钩子、完备监控、持久化或机器故障恢复；生产优先采用 ThreadPoolExecutor。计数为零与任务成功是不同结果，普通任务失败应从 Future 读取。
