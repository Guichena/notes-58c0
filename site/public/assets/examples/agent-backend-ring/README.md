# CloseableRing 合同练习

依赖：完整 JDK 21 或以上、Python 3。无网络、服务或第三方库。
解压后在本目录运行：python3 run_tests.py（Windows 可用 python）。
运行器优先使用 JAVA_HOME，并调用 JDK 编译器模块；构建文件放入临时目录，结束后清理。

CloseableRing.java 和 Checks.java 沿用既有教学实现；本包只加入专门合同测试。
push 不等待容量但会获取锁；null 被禁止，0 和 false 合法；close 拒绝新写并排空；pop 的 ITEM/TIMEOUT/CLOSED 要先判断状态。
正常操作 O(1) 指数组修改次数，不承诺等待时间、公平或持久化。

RingContractTest 覆盖构造容量、容量 1、回绕 FIFO、head/tail/count、真假值、null、空满、超时预算、真实 Condition 等待者的关闭唤醒、关闭与入队竞争、统计溢出。
原实现 main 还执行 4 个生产者、4 个消费者，共 4000 个值的无丢失无重复与中断测试。
测试中反射只用于核对内部状态和注入计数边界，不能作为业务 API。通过有限测试不证明所有可能调度交错。
