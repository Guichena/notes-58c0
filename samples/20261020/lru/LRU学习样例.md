# 手写 LRU：从口述到可验证实现

> 独立学习样例 · 2026-10-20 · Java 集合 / 算法与数据结构
>
> 阅读路线：先读「30—60 秒口述」，再看执行轨迹与不变量，最后运行代码、练习变体。基础泛型实现已执行测试；TTL 与并发部分是设计推演，不是已实现功能。本文不修改既有题库基线。

## 1. 30—60 秒口述

LRU 在容量不够时淘汰最久没有被访问的条目。我会用哈希表按键定位节点，用双向链表维护访问顺序：命中和更新都把节点移到头部，新键插在头部，超容量就删除尾部节点并同步删除哈希表记录。双向链表让已知节点的移动和尾部淘汰都是常数次指针操作；哈希操作在散列良好时具有期望常数成本，插入还要考虑扩容的均摊成本，不能说每次最坏都是 O(1)。这个版本是单线程、按条目数限制容量；TTL 要另定过期语义，多线程则必须保护哈希表和链表的整个复合操作。

## 2. 题目与实现契约

母题：实现固定容量 LRU，支持按键读取与写入，并说明正确性和复杂度。

本样例明确以下约束，避免用代码偷偷决定题意：

- 类型：`LruCache<K,V>`，泛型键值；运行核验使用 Java 21，无第三方依赖。
- 容量：非负整数，单位是条目数，不是字节数。负容量抛 `IllegalArgumentException`；零容量允许构造，但不保存任何数据。
- 读取：命中返回值并刷新最近使用顺序；未命中返回 `null`，不改变顺序。
- 写入：已有键覆盖值并刷新顺序，不增加条目数；新键插入，必要时淘汰一个旧键。`put` 不返回旧值。
- 空值：拒绝 `null` 键和值，抛 `NullPointerException`，包括容量为零时。这样 `get` 返回 `null` 只表示未命中，而不是“保存了空值”。整数题常用的 `-1` 不是这个泛型接口的约定。
- 键：存入期间 `equals` 和 `hashCode` 必须稳定且遵守 Java 约定；这里的复杂度分析假设两者为 O(1)。例如修改作为键的对象中参与散列的字段，会破坏查找，不是链表能补救的问题。
- 可见性：值是对象引用，不做深复制；容器的语义不保证返回对象本身不可变。
- 范围：没有 TTL、加载器、持久化、分布式同步和并发保证；不对内存耗尽或恶意抛异常的键提供事务回滚。

## 3. 为什么是哈希表加双向链表

### 基线与瓶颈

只用列表可以维护新旧顺序，但读取指定键需要扫描，最坏 O(n)。只用哈希表容易找到值，却没有最近访问顺序；每次扫描所有条目挑最旧的一个也要 O(n)。这里 n 是当前缓存条目数。

优化不是“再加一个数据结构”而已，而是让两者共享同一个节点：哈希表保存 `key → Node`；节点含 `key、value、prev、next`。找到节点后，不再扫描链表。双向链接使我们能同时修复前驱和后继；普通单链表若只知道当前节点，无法直接更新其前驱。

### 四种操作路径

1. 读不到：哈希表查询为空，直接返回，不挪动其他节点。
2. 读到：从旧位置摘除该节点，接到头哨兵之后，再返回值。
3. 更新：修改同一个节点的值，再移到头部。不能另建重复节点，否则哈希表只有一份记录，链表却有多份。
4. 新增：加入哈希表和链表头。若条目数超过容量，删除尾哨兵之前的节点，并按节点保存的键删掉哈希表记录。

头尾哨兵不是有效条目，只把空表、单节点表和一般情况统一起来。头部是真正的最近使用者，尾部是真正的最久未使用者；不要把方向说反。

## 4. 手算轨迹：容量为 2

以下顺序都从「最近使用 → 最久未使用」书写。

| 操作 | 返回 | 操作后的顺序 | 为什么 |
|---|---|---|---|
| `put(1,"a")` | 无 | `[1]` | 新键进入头部 |
| `put(2,"b")` | 无 | `[2,1]` | 后写入的键更近 |
| `get(1)` | `"a"` | `[1,2]` | 命中刷新顺序 |
| `get(99)` | `null` | `[1,2]` | 未命中不刷新任何键 |
| `put(3,"c")` | 无 | `[3,1]` | 淘汰键 2，而不是键 1 |
| `put(1,"A")` | 无 | `[1,3]` | 覆盖同一键，大小仍为 2 |
| `put(4,"d")` | 无 | `[4,1]` | 淘汰键 3 |

这也区分了 LRU 和 FIFO：FIFO 关注进入时间，读取键 1 不会让它变年轻；LRU 关注最近访问。

## 5. 不变量与正确性

在每个公开方法正常返回后，保持四个不变量：

1. 哈希表与链表真实节点一一对应。每个键只对应一个节点，哨兵不在哈希表中。
2. 双向连接一致：若 `a.next == b`，则 `b.prev == a`；从头到尾可到达所有节点且不重复。
3. 链表由近到远排列，与我们定义的访问事件顺序一致。
4. `0 ≤ size ≤ capacity`，`size` 以哈希表的条目数为准，避免另维护计数器产生不同步。

归纳证明：构造后是空表，全部条件成立。未命中不改状态；命中或更新只把唯一对应节点摘下并放到头部，不改变其他节点相对顺序，所以它成为最新，其余新旧关系不变。新增键后它最新，若超容量，原来最旧的尾节点恰是应淘汰者；同时从两个结构中删除它，恢复一一对应和容量限制。容量零直接不存储，仍成立。

注意这里是方法边界上的不变量。`put` 内部可能短暂有 capacity+1 个节点，单线程外部看不到这个中间状态；如果直接并发使用，这个推理就不成立。

## 6. 完整 Java 实现

下面代码与同目录 `LruCache.java` 一致。末尾两个包级方法仅供测试观察与不变量检查，不是业务 API，且不是 O(1) 操作。

```java
import java.util.ArrayList;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Single-threaded, count-bounded LRU. Null keys/values are rejected. */
public final class LruCache<K, V> {
    private static final class Node<K, V> {
        final K key;
        V value;
        Node<K, V> prev;
        Node<K, V> next;
        Node(K key, V value) { this.key = key; this.value = value; }
    }
    private final int capacity;
    private final Map<K, Node<K, V>> index = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null);
    private final Node<K, V> tail = new Node<>(null, null);

    public LruCache(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("capacity < 0");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    /** Returns null on a miss. A hit becomes most recently used. */
    public V get(K key) {
        Objects.requireNonNull(key, "key");
        Node<K, V> node = index.get(key);
        if (node == null) return null;
        moveToFront(node);
        return node.value;
    }

    /** Updates count as accesses. A zero-capacity cache stores nothing. */
    public void put(K key, V value) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        if (capacity == 0) return;
        Node<K, V> node = index.get(key);
        if (node != null) {
            node.value = value;
            moveToFront(node);
            return;
        }
        node = new Node<>(key, value);
        index.put(key, node);
        addFirst(node);
        if (index.size() > capacity) {
            Node<K, V> victim = tail.prev;
            unlink(victim);
            index.remove(victim.key);
        }
    }

    public int size() { return index.size(); }

    private void moveToFront(Node<K, V> node) {
        unlink(node);
        addFirst(node);
    }

    private void unlink(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = null;
        node.next = null;
    }

    private void addFirst(Node<K, V> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    // Package-private test aids, not part of the public cache API.
    List<K> keysMostRecentFirst() {
        List<K> result = new ArrayList<>();
        for (Node<K, V> n = head.next; n != tail; n = n.next) result.add(n.key);
        return result;
    }

    void checkInvariants() {
        if (head.prev != null || tail.next != null || head.next == null || tail.prev == null)
            throw new AssertionError("bad sentinels");
        IdentityHashMap<Node<K, V>, Boolean> seen = new IdentityHashMap<>();
        Node<K, V> previous = head;
        for (Node<K, V> n = head.next; n != tail; n = n.next) {
            if (n == null || n == head || seen.put(n, true) != null)
                throw new AssertionError("broken path or cycle");
            if (n.prev != previous || index.get(n.key) != n)
                throw new AssertionError("links/index disagree");
            previous = n;
        }
        if (tail.prev != previous || seen.size() != index.size() || index.size() > capacity)
            throw new AssertionError("size/tail mismatch");
        for (Node<K, V> n : index.values()) {
            if (!seen.containsKey(n)) throw new AssertionError("unlinked node");
        }
    }
}
```

## 7. 复杂度：不要把三种口径混为一谈

令 n 为当前条目数，C 为配置容量。以下不包含键和值对象的内部存储；假设计算散列、比较键和读写引用都是 O(1)。

- 已定位节点的摘链、插头、删尾：最坏 O(1)，只修改常数个指针。
- `get`：散列分布良好时，哈希查找期望 O(1)，加上 O(1) 摘插链。
- `put`：散列良好时，期望均摊 O(1)。一次插入可能扩容搬迁，不保证单次最坏 O(1)。
- 最坏情况：保守写 O(n)，涵盖严重碰撞下的查找及扩容。不能仅因某些 JDK 实现有树化就对任意键宣称最坏 O(log n)；Java API 也没有给出“所有键、每次操作都 O(1)”的承诺。[HashMap API 的性能前提](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html)
- 容器空间：当前结构 O(n+1)，最大 O(C+1)，含哈希索引、真实节点和两个哨兵。零容量仍有常数开销。若值大小不同，限制条目数不能限制精确字节数。
- 测试辅助方法：顺序快照是 O(n) 时间及 O(n) 输出空间；不变量检查还要访问哈希表，散列良好时为 O(n)，严重碰撞下可能更高。这些不在每次正式 `get/put` 内执行。

“期望”来自对散列分布的假设，“均摊”来自把偶发扩容成本摊到操作序列上，两者不是同义词。对象分配、垃圾回收和线程调度还会影响实际延迟，算法 O(1) 不等于延迟上限。

## 8. 可重复执行的测试与实际结果

交付文件：

- `LruCache.java`：完整实现。
- `LruCacheTest.java`：不依赖 JUnit 的可执行测试；断言失败即抛异常退出，不依赖 JVM 的 `-ea` 开关。
- `run-tests.sh`：编译并运行；优先使用 `javac`，没有该命令时调用 JDK 编译器模块。
- `test-results.txt`：实际运行输出。

在此目录执行：

```sh
./run-tests.sh
```

若在 Windows 或手动执行：

```sh
javac -encoding UTF-8 -d build LruCache.java LruCacheTest.java
java -cp build LruCacheTest
```

需要包含编译器的 JDK，而不只是裁剪后的 JRE。测试使用 `List.of` 等 API；本批只核验 Java 21，不声称已经核验其他版本。

测试覆盖：负容量异常、空缓存读取、零容量不存储、空键/值拒绝、容量 1、重复更新不增大小、命中刷新、未命中不改变顺序、精确淘汰、整数极值键、多个相等但不同实例的键、同一散列值的冲突键。每个关键状态检查链表与索引对应关系。

另使用 Java `LinkedHashMap` 的访问顺序模式作为差分模型，在容量 0、1、2、7、32 下各做 10000 次确定性随机操作，逐步比较读取结果、条目数和顺序。随机种子为 `20261020L + capacity`。官方 API 明确了访问顺序模式和哪些操作算作访问，因此可以作为这里的语义参照，但随机测试不是形式化证明。[LinkedHashMap API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html)

2026-10-20 实际运行环境与输出：

```text
openjdk version "21.0.12.1" 2026-08-18
OpenJDK Runtime Environment (build 21.0.12.1+1-1-deb13u1-Debian)
OpenJDK 64-Bit Server VM (build 21.0.12.1+1-1-deb13u1-Debian, mixed mode, sharing)
javac 21.0.12.1
PASS: 125128 assertions; 50000 randomized operations; invariants checked.
```

实际入口为从项目根运行 `./samples/lru/run-tests.sh`。该环境没有 `javac` 命令，脚本成功使用 `java -m jdk.compiler/com.sun.tools.javac.Main` 编译。这里没有做性能基准、并发压力或 TTL 测试，不能把上述结果解释为这些方面已通过。

## 9. 追问一：如果允许用标准库，还需要自己写链表吗？

不一定。Java `LinkedHashMap` 可以使用 `accessOrder=true`，按访问顺序维护条目，并通过覆盖 `removeEldestEntry` 设置容量淘汰条件。要显式选访问顺序，而不是默认插入顺序。写成 `size() > capacity` 才是插入后超限时淘汰，而不是提前少存一项。

这里手写的价值是展示跨结构不变量和 O(1) 摘插链，不是宣称比标准库更适合生产。库方案仍需要单独明确空值策略、零容量、并发访问和过期语义；换成库并不自动得到 TTL 或线程安全。

## 10. 追问二：给 LRU 加 TTL，如何才算回答完整？

以下是变体设计，不是当前代码已有功能。

### 先确定语义

例如选择「写入后 T 时间过期」，再次写入重置计时，普通读取只刷新 LRU 顺序、不延长 TTL；在 `elapsed >= T` 时视为已过期，T=0 立即过期，负数拒绝。若选择“最后访问后 T 过期”，读命中也要重置时钟，行为和实现成本都不同。

LRU 回答“空间不够时淘汰谁”，TTL 回答“数据何时失效”。二者独立，不能用最近访问顺序冒充过期时间顺序。

### 懒删除能保证什么

节点保存写入时刻。`get` 找到后先检查过期：过期则同时删索引和链表、返回未命中；不过期才移头并返回。这样可以保证不返回过期值，但未被访问的过期节点仍可能占空间。

如果新写入只按 LRU 尾部淘汰，可能出现一个过期节点留在头部，而尾部未过期节点被淘汰。例如写后过期策略中，旧写入键刚被读取，顺序变新但 TTL 没延长。此时需要明确：允许物理条目占容量且接受这种命中率损失，还是要求优先回收所有过期条目。后一种要求不能只检查尾节点；全表扫描一次是 O(n)。

### 主动清理的选择与代价

- 周期扫描：实现直观，每轮 O(n)，清理时间有周期和调度延迟；即使后台在扫，读路径仍需检查到期，不能保证线程及时被调度。
- 最小堆：按到期时间找到最近应删除的条目，增加或变更记录通常 O(log n)。如果用旧记录留堆、版本号判失效的方式，必须丢弃旧版本，避免旧任务误删重新写入的新值；还要控制过期任务数量，不能把堆空间仍写成必然 O(C)。
- 时间轮：可按时间桶批量处理，适合精度与规模匹配的情形；付出时间粒度、轮转和长时限处理的复杂度，不应无条件宣布每次操作严格 O(1)。

单进程持续时间可用 `System.nanoTime()` 的差值，不用它表示日期或跨进程持久化时间。Java 文档建议使用差值比较以避免直接相加溢出；还应限制支持的 TTL 范围并为测试注入可控时钟，不靠真实睡眠验证边界。[System.nanoTime API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/System.html#nanoTime())

该变体的验收应新增：到期前、恰好到期、到期后；重写延期；读不延期；过期节点占满容量；旧定时记录不能删除新版本；时钟边界。这些测试本批尚未实现。

## 11. 追问三：换成 ConcurrentHashMap 就线程安全了吗？

不会。它只保障其自身提供的并发操作语义，不会把我们独立维护的双向链表和“判断超限→找尾→删除两处”的流程自动变成原子操作。[ConcurrentHashMap API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html)

一个具体竞态：线程 A 从索引取到节点 X；线程 B 淘汰 X、摘掉其链接；A 再按旧节点移动，可能遇到空链接，或者把已无索引的 X 接回链表。即使两个结构各自操作不抛异常，也可能破坏容量和对应关系。

最简单的严格方案是让所有公开访问共享一把锁：锁内完成 `get` 的查询和移动，`put` 的更新、插入和淘汰，`size` 与快照也采用同一同步策略，不泄漏可修改的内部节点。锁内方法完成后才让其他线程进入，可以按锁获取顺序解释操作，从而维护严格全局 LRU 的线性化语义。普通读锁不适合命中的 `get`，因为它会改变访问顺序。不要只锁 `put`，也不要只分别锁哈希表和链表却把二者之间的间隙留给别的线程。

代价是命中读取也竞争同一把锁。分段 LRU 可减小锁争用，但每段淘汰不等于全局最旧项淘汰；异步批量记录访问可提高吞吐，却把访问顺序变成近似。是否接受，要根据吞吐、尾延迟、命中率和一致性目标取舍，不能说这是“同样语义的免费优化”。容器线程安全也不让返回的可变值自动线程安全。

如果还加入加载函数，单个 `get` 原子也不代表外部的 `get→加载→put` 原子；要另设计同键请求合并、失败与重试、取消，以及避免在全局锁内做耗时 I/O。本批不提供并发或加载器实现，也未执行相应测试。

## 12. 追问四：LRU 一定是最好的淘汰策略吗？

不是。LRU 利用近期访问预测未来访问，适合具有时间局部性的负载。但容量 C 的缓存若循环访问 C+1 个键，稳定阶段可能每次都未命中；一次性大范围扫描也可能把热点逐出。这些是可以手算的反例，不是生产压测数据。

选择策略时要比较真实请求轨迹下的命中率、维护开销、尾延迟和条目大小。按字节限制时还要引入权重；插入一个大对象可能需要连续淘汰多个条目，因此不能沿用“每次最多删一个、最坏常数次淘汰”的分析。TTL 也不能替代准入策略或一致性设计。

## 13. 依据与完成状态

题目范围来自学习项目中保留的 LRU 母题及泛型、TTL、并发变体；这只用于定义要答什么，不作为技术结论依据，也不声称该题在任何公司出现的频次。答案、轨迹、证明和代码为本样例组织编写。

公开依据均于 2026-10-20 查阅，版本固定为 Java SE 21：

1. [HashMap：散列性能前提、扩容、同步说明](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html)
2. [LinkedHashMap：访问顺序、访问事件与淘汰扩展点](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html)
3. [ConcurrentHashMap：并发读取和更新的保证边界](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html)
4. [System.nanoTime：持续时间测量及溢出比较](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/System.html#nanoTime())

验收结论：基础泛型 LRU 已编译并通过本批测试；复杂度注明前提；变体保留并给出语义、机制与验收项，但 TTL / 并发只完成设计回答，未完成代码实现或测试。保存本文件不能替代这些未完成变体的核验。
