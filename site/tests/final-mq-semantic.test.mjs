import {capacity,kafkaCapacity,assertKafkaCapacity} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-answer-contracts/verify-phase5-capacity-prefix.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Portable final-dist test: copy into site/tests with fixtures/mq-semantic.
// Deliberately no environment override and no imports from candidate/control files.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fixtureUrl = new URL('./fixtures/mq-semantic/expected.json', import.meta.url);
const fixtureBytes = await readFile(fixtureUrl);
const expected = JSON.parse(fixtureBytes);
const catalog = JSON.parse(await readFile(path.join(dist, 'data/catalog.json'), 'utf8'));
const catalogById = new Map(catalog.entries.map(e => [e.id, e]));
const chunkCache = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
const decode = text => text
  .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/&#([0-9]+);/g, (_, x) => String.fromCodePoint(Number(x)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const visible = text => decode(text.replace(/<[^>]*>/g, ''));
const internalLinks = text => [...text.matchAll(/<a\b[^>]*href="(#\/e\/[^\"]+)"[^>]*>/g)].map(m => decode(m[1]));
const onlyIdentity = item => Object.fromEntries(Object.entries(item).filter(([key]) => !['a', 'lead'].includes(key)));
const hasAll = (text, terms, label) => {
  for (const term of terms) assert.ok(text.includes(term), `${label}: missing ${term}`);
};
const section = (body, title) => {
  const headings = [...body.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];
  const index = headings.findIndex(h => visible(h[1]) === title);
  assert.ok(index >= 0, `Missing main-answer section: ${title}`);
  return visible(body.slice(headings[index].index + headings[index][0].length,
    headings[index + 1]?.index ?? body.length));
};
async function loadEntry(id) {
  const meta = catalogById.get(id);
  assert.ok(meta, `Missing final catalog entry: ${id}`);
  assert.equal(typeof meta._chunk, 'string', `Missing actual chunk for ${id}`);
  const chunk = path.resolve(dist, meta._chunk);
  const relative = path.relative(dist, chunk);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Unsafe chunk path: ${meta._chunk}`);
  if (!chunkCache.has(chunk)) chunkCache.set(chunk, JSON.parse(await readFile(chunk, 'utf8')));
  const matches = chunkCache.get(chunk).entries.filter(e => e.id === id);
  assert.equal(matches.length, 1, `Expected one real final chapter entry: ${id}`);
  return matches[0];
}
const actualEntries = new Map(await Promise.all(expected.entries.map(async e => [e.entryId, await loadEntry(e.entryId)])));
const question = key => {
  const reference = expected.questions.find(q => q.stableReviewKey === key);
  assert.ok(reference, `No expected question ${key}`);
  return actualEntries.get(reference.entryId).items[reference.index];
};
const body = key => question(key).a;
const text = key => visible(body(key));

// Structural checks read the final catalog and actual chapters, never the repair records.
test('MQ metadata is small and pins exactly seven questions, fourteen leaves and five stable entries', () => {
  assert.equal(expected.schemaVersion, 1);
  assert.ok(fixtureBytes.length < 20 * 1024, 'Fixture should contain metadata/hashes, not full answer copies');
  assert.equal(expected.questions.length, 7);
  assert.equal(expected.fields.length, 14);
  assert.equal(expected.entries.length, 5);
  assert.equal(new Set(expected.questions.map(q => q.stableReviewKey)).size, 7);
  assert.equal(new Set(expected.fields.map(f => `${f.entryId}#${f.index}.${f.field}`)).size, 14);
  assert.ok(expected.fields.every(f => ['a', 'lead'].includes(f.field)));
  assert.equal(expected.expectedQuestionCount, 7);
  assert.equal(expected.expectedLeafCount, 14);
});

test('final MQ entry metadata, question identities, sibling order, counts and review flags are unchanged', () => {
  for (const ref of expected.entries) {
    const entry = actualEntries.get(ref.entryId);
    assert.deepEqual(Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'items')), ref.identity);
    assert.equal(entry.items.length, ref.itemCount, `${entry.id}: item count drift`);
    assert.deepEqual(entry.items.map(onlyIdentity), ref.itemIdentities, `${entry.id}: identity or index drift`);
    const indexed = catalogById.get(entry.id);
    assert.equal(indexed.items.length, ref.itemCount);
    for (const key of ['id', 'kind', 'mod', 'part', 'cat', 'title', 'number']) assert.equal(indexed[key], ref.identity[key]);
    for (let i = 0; i < ref.itemCount; i++) {
      assert.equal(indexed.items[i].mk, entry.items[i].mk, `${entry.id}[${i}]: catalog review flag`);
      assert.equal(indexed.items[i].id, entry.items[i].id, `${entry.id}[${i}]: catalog item identity`);
    }
  }
  for (const ref of expected.questions) {
    assert.equal(actualEntries.get(ref.entryId).items[ref.index].q, ref.question);
    assert.equal(ref.route, `#/e/${ref.entryId}/${ref.index}`);
  }
});

test('all fourteen final chapter leaves equal the reviewed hashes and each lead is the actual first paragraph', () => {
  for (const ref of expected.fields) {
    const value = actualEntries.get(ref.entryId).items[ref.index][ref.field];
    assert.equal(typeof value, 'string');
    const finalSha=ref.entryId==='bg-kafka-4'&&ref.index===1&&ref.field==='a'?(assert.equal(ref.sha256,kafkaCapacity.beforeSha256),assertKafkaCapacity(actualEntries.get(ref.entryId).items[ref.index]),kafkaCapacity.afterSha256):ref.sha256;
    assert.equal(sha(value), finalSha, `${ref.entryId}[${ref.index}].${ref.field} does not match reviewed final text`);
    assert.notEqual(ref.sha256, ref.beforeSha256, 'A replacement must not silently revert to its old body');
  }
  for (const ref of expected.questions) {
    const item = question(ref.stableReviewKey);
    assert.ok(item.a.startsWith(item.lead), `${ref.stableReviewKey}: lead must be first`);
    assert.match(item.lead, /^<p\b[^>]*>[\s\S]*<\/p>$/);
    const finalCharacters=ref.stableReviewKey==='bg-kafka-4#1'?(assert.equal(ref.bodyCharacters,kafkaCapacity.oldBodyCodePoints),kafkaCapacity.newBodyCodePoints):ref.bodyCharacters;
    assert.equal([...item.a].length, finalCharacters, `${ref.stableReviewKey}: code-point length`);
  }
});

test('old appendix IDs remain exactly once and theory answers contain no code or editing-source language', () => {
  for (const ref of expected.questions) {
    const html = body(ref.stableReviewKey);
    assert.deepEqual([...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]), ref.originalAppendixIds);
    assert.doesNotMatch(html, /<(?:pre|code)\b|```/i);
    assert.doesNotMatch(visible(html), /原题|原来的|一次最多先拉多少条/);
    assert.doesNotMatch(html, /<script\b|\bon\w+\s*=/i);
  }
});

test('prefetch main answer separates pushed subscription windows, polling, acknowledgement and QoS scope', () => {
  hasAll(visible(question('bg-rabbitmq-4#1').lead), ['未确认交付窗口', '推送消息', '不是每次主动拉取的条数', '不是工作线程数'], 'prefetch lead');
  hasAll(section(body('bg-rabbitmq-4#1'), 'prefetch 限制什么，作用域在哪里？'),
    ['basic.consume', 'Broker 异步推送', 'basic.get', '不受这项 QoS', '自动确认',
      'per-consumer', 'classic', 'channel', 'quorum', '不支持 global QoS', 'channel 错误', '0 表示不请求该项限制'], 'prefetch scope');
  hasAll(section(body('bg-rabbitmq-4#1'), '窗口、并发和内存怎样权衡？'),
    ['重投', '分配不公平', '1000 倍', '20 个线程', 'prefetch × M', '解码膨胀', 'unacked', '300ms', '2–3', '10–20', '窗口 4', '不是通用最优值'], 'window tradeoff');
});

test('prefetch preserves end-to-end backpressure, durable Outbox and timeout-not-cancellation contracts', () => {
  hasAll(section(body('bg-rabbitmq-4#1'), 'Broker blocked 与消费者慢怎样区分？'),
    ['生产进入速度', '已有责任完成速度', 'flow/blocked', '生产和消费连接分开', '供应商配额',
      '提前 ACK', 'Outbox', '拒绝本次内存接纳', '不能先标已发送', '旧传输', '关联表与许可',
      'HTTP、SQL、socket', 'Future 等待超时', '不证明远端或工作线程停止'], 'end-to-end backpressure');
  hasAll(section(body('bg-rabbitmq-4#1'), '追问：怎样验证回压真的传回上游？'),
    ['最老年龄', 'Outbox 年龄', 'P0 并发 4–8、窗口 10', 'P1 并发 4–8、窗口 20',
      '普通任务并发 2–16、窗口 20', '并发 2、窗口 50', '没有测量背书'], 'bounded illustrative samples');
});

test('TTL canonical explanation retains message-versus-queue expiry, head blocking and DLX acceptance conditions', () => {
  hasAll(section(body('bg-rabbitmq-3#1'), 'TTL + DLX 怎样工作，为什么会被队头挡住？'),
    ['message TTL', 'x-message-ttl', 'expiration', '毫秒', '较小期限', 'x-expires', 'queue expiry',
      '一小时', '十秒', '五分钟与三十秒', '计划到期与实际完成'], 'TTL mechanism');
  hasAll(section(body('bg-rabbitmq-3#1'), '入口 Confirm 为什么还不能证明任务不丢？'),
    ['Outbox', '不覆盖以后 DLX 再发布', '不覆盖业务提交', '没有内部 publisher confirm',
      'at-least-once', 'reject-publish', 'stream_queue', 'at-most-once', 'drop-head',
      '重复', 'durable', 'persistent delivery mode', 'Inbox', '同事务提交'], 'DLX responsibility');
});

test('TTL preserves historical-plugin and current-retry protocol/version boundaries', () => {
  hasAll(section(body('bg-rabbitmq-3#1'), '旧插件、4.3 重投和新版本能力怎样区分？'),
    ['x-delayed-message', 'x-delay', 'Mnesia', '单副本', '永久丢节点', '禁用插件', 'mandatory Return',
      '2026-10-17', '归档', '4.3', '4.4', '消费者返回消息', 'AMQP 1.0 modify',
      'AMQP 0-9-1 basicPublish', '4.3.6', '示例假设', '目标正式发行版', '历史 4.x 固定延迟级别'], 'plugin/version contracts');
});

test('TTL retains durable scheduling, order/payment/coupon/cart and alert-round unique details', () => {
  hasAll(section(body('bg-rabbitmq-3#1'), '长时间、改期与取消为什么需要持久任务账？'),
    ['taskId', 'dueAt', 'scheduleVersion', '输入引用', '重试预算', '最小堆或时间轮', '持久账恢复',
      '租约到期不代表旧执行已经停止', '近端窗口', '同刻到期洪峰', '同一合法状态转换'], 'durable scheduling');
  hasAll(section(body('bg-rabbitmq-3#1'), '追问：超时关单与支付、库存、优惠券怎样竞争？'),
    ['十五分钟', '原子条件更新', '数据库当前时间', 'CLOSED', '提前到达', '晚到', '支付调用超时',
      '晚到支付、退款或人工核对', '唯一释放流水', '用户购买资格', '购物车行、版本及下单数量',
      '优惠券占用绑定订单/预留号与版本', '冻结结果', 'Redis Lua', '崩溃窗口'], 'business race conditions');
  hasAll(section(body('bg-rabbitmq-3#1'), '追问：通知恢复后，旧触发消息还能发吗？'),
    ['同一告警轮次', 'P0/P1', 'P2/P3', '业务确认', '10:31', '10:33', '权威当前状态',
      '增量事件', '多数不可用', '停机恢复'], 'alert ordering and recovery');
});

test('Rocket half-message answer preserves durable commit evidence and absence-versus-rollback distinction', () => {
  hasAll(section(body('bg-rocketmq-3#2'), '完整时序，以及回滚究竟回滚了什么？'),
    ['先把半消息', '随后执行本地业务事务', 'COMMIT', 'ROLLBACK', '不会撤销消费者或外部服务',
      'UNKNOWN', 'SQLException 本身不能证明数据库没有提交'], 'half timeline');
  hasAll(section(body('bg-rocketmq-3#2'), '第二次确认丢失，回查凭什么作决定？'),
    ['持久事务标识、结果和消息指纹', '不能依赖原 JVM', '不能为了回答回查再扣一次款',
      '尚未开始', '落后副本', '可靠终态', '另一生产者', '有业务无消息', 'Outbox'], 'half recovery evidence');
  hasAll(section(body('bg-rocketmq-3#2'), '为什么不能无限等待 UNKNOWN？'),
    ['5.0', '时长、次数与事务超时', '默认策略回滚', '不证明本地数据库确实回滚', '受控补发',
      '最老 half / UNKNOWN', 'Inbox', 'XA', '幂等、查询和补偿'], 'finite-check and effect boundary');
});

test('Rocket version-specific source facts and full failure matrix stay outside the repeated main timeline', () => {
  hasAll(section(body('bg-rocketmq-3#2'), '版本追问：4.9.8 客户端的实际分支是什么？'),
    ['4.9.8', 'LocalTransactionState.UNKNOW', 'sendMessageInTransaction', 'SEND_OK',
      'FLUSH_DISK_TIMEOUT', 'FLUSH_SLAVE_TIMEOUT', 'SLAVE_NOT_AVAILABLE', '5.x SDK'], '4.9.8 branch');
  hasAll(section(body('bg-rocketmq-3#2'), '怎样验证故障后能收敛？'),
    ['回包丢失', '本地事务前退出', '确定回滚', 'commit 响应丢失', '报告失败',
      '事务仍运行', '生产者重启', '事务证据丢失', '最终超时', '不能当作已完成'], 'half failure plan');
});

test('canonical Kafka ordering answer retains causality, routing migration, retry reorder and bounded safe progress', () => {
  hasAll(section(body('bg-kafka-3#0'), '为什么同 key 同分区仍不够？'),
    ['v1 创建、v2 支付、v3 关闭', '实际抵达顺序', '线程池', '接收顺序和业务提交顺序',
      '本地时间戳', 'aggregateId', 'Outbox', 'leader/replica', '三层'], 'ordering layers');
  hasAll(section(body('bg-kafka-3#0'), '默认路由、发送重试和扩分区各有什么边界？'),
    ['显式指定 partition', '黏性策略', 'partitioner.ignore.keys', '自定义分区器',
      '批次 A', 'B', '单在途', '迁移屏障', '路由版本', '排空旧流', '不支持随意就地减少',
      'records/s', 'bytes/s', '一万条小事件'], 'routing and capacity');
  hasAll(section(body('bg-kafka-3#0'), '怎样兼顾实体顺序、吞吐与安全位移？'),
    ['不同实体并行', '同一实体串行', '热点实体', '安全完成的前缀', '不要求 offset 整数连续',
      '在途窗口', '背压', 'Retry topic', 'DLT', '支付事实', 'UNKNOWN', '旧 consumer', '撤销副作用'], 'safe ordered processing');
});

test('ordering preserves snapshot/delta, tombstone/replay, sensor/transcript and producer-immutable reordering conditions', () => {
  hasAll(section(body('bg-kafka-3#0'), 'eventId、版本、快照与增量怎样分工？'),
    ['同版本不同内容', '协议冲突', '库存加 3', '版本 10', '版本 9', '可交换且每条只执行一次',
      '墓碑', '主键迁移', 'compact', 'delete', '重建搜索索引', '重新发邮件'], 'version/replay contracts');
  hasAll(section(body('bg-kafka-3#0'), '追问：遥测、实时转写，或不能改生产者怎么办？'),
    ['传感器', '累计计数', '每笔告警', 'sessionId', 'segmentId', 'revision', '有界重排缓冲',
      '缺口超时', '不能凭到达时间推断真实先后', '分区offset'], 'specialized ordering cases');
  hasAll(section(body('bg-kafka-3#0'), '换产品时，顺序合同要怎样保留？'),
    ['RabbitMQ', '同一 channel', '优先级', '单活消费者本身不等于', '5.x', 'message group',
      'SimpleConsumer', '重试次数耗尽', '不同 message group', 'max.poll.interval'], 'product-specific ordering');
});

test('the second ordering question is a short stable guide to the canonical answer and exact safe-prefix question', () => {
  const guide = question('bg-kafka-3#1');
  assert.ok(visible(guide.a).length < 300, 'Ordering alias must stay a short guide');
  assert.ok(visible(guide.a).length < visible(body('bg-kafka-3#0')).length / 5);
  assert.deepEqual(internalLinks(guide.a), ['#/e/bg-kafka-3/0', '#/e/own-mq-kafka/q-own-mq-safe-offset-prefix']);
  hasAll(visible(guide.a), ['同订单串行', '不同订单并行', '热点实体', '快照与增量', '迁移屏障',
    'Rebalance', 'p99', '安全完成的前缀', 'offset 有空洞', '在途窗口', '背压'], 'short ordering guide');
});

test('Kafka transactions retain stable logical identity, offsets/epochs, LSO and exact commit-timeout recovery', () => {
  hasAll(section(body('bg-kafka-3#4'), '一次事务怎样完整走完？'),
    ['transactional.id', 'initTransactions', 'beginTransaction', 'sendOffsetsToTransaction',
      'group metadata', 'commitTransaction', '关闭自动提交', '事务外独立提交',
      '逻辑实例必须不同', '恢复接管则要稳定', 'fencing', 'nextOffsets', 'leader epoch', '安全前缀'], 'transaction sequence');
  hasAll(section(body('bg-kafka-3#4'), 'read_committed 的可见性与代价是什么？'),
    ['read_uncommitted', 'read_committed', 'last stable offset', '普通记录', 'CPU 不足',
      '同一次 poll', '全局业务快照', 'transaction.max.timeout.ms', '长模型推理'], 'transaction visibility');
  hasAll(section(body('bg-kafka-3#4'), '失败以后能不能一律 abort 再重做？'),
    ['abort 不会自动把 consumer.position 倒回去', 'ProducerFencedException', '4.0.2',
      '超时或中断', '重试同一次提交', '关闭 producer', '不能切换到 abort', '未决事务', '恢复状态机'], 'transaction recovery');
});

test('Kafka transaction DLT transfer and validation retain business dependencies and external-effect limits', () => {
  hasAll(section(body('bg-kafka-3#4'), '幂等、DLT 和外部效果分别覆盖什么？'),
    ['Producer ID、epoch 和分区序列', 'eventId', 'in-flight', '原 value', 'topic/partition/offset',
      '错误分类和 schema', 'DLT 不可用', '不授权跳过业务依赖', '外部修复表', 'abort 也撤不回'], 'DLT and external effects');
  hasAll(section(body('bg-kafka-3#4'), '纯 Kafka 转换怎样验证？'),
    ['有界 poll', '没有输入', '整批输出', '后继位移', '不逐条等待发送', 'minISR',
      '事务内部 topic', '权限', '初始化接管', '提交超时', '没有实际运行证据'], 'pure conversion scope');
});

test('lag explanation keeps true business progress, protocol blocking, net drain math and retention coverage', () => {
  hasAll(section(body('bg-kafka-4#1'), '先看哪五组信号？'),
    ['每分区输入率、字节率', '业务持久完成水位', 'commit 失败', '最老未完成记录年龄',
      'offset 差不是精确待办条数', 'LSO', 'ready', 'unacked', '毒消息'], 'lag diagnosis');
  hasAll(section(body('bg-kafka-4#1'), '按瓶颈选择扩容、隔离或背压'),
    ['下游', 'I/O 密集用有界异步', '目的端配额', '普通 Kafka 消费组', '实体串行上限',
      '余额和库存不能随机打散', '迁移屏障', '高水位', 'pause', '低水位', 'resume', 'poll 与存活'], 'lag control');
  const math = section(body('bg-kafka-4#1'), '为什么恢复时间是 600 秒，而不是 120 秒？');
  hasAll(math, ['800 条/秒', '1000 条/秒', '120000 条', '200 条/秒', '600 秒', '120 秒',
    '1100', 'offset 差当任务数', '有效持久完成率', '已有最老年龄、修复、追赶'], 'drain model');
  assert.equal(120000 / (1000 - 800), 600);
  assert.equal(120000 / 1000, 120);
});

test('lag retains persistent failure responsibility, Rocket consumer visibility and non-MQ overload alternatives', () => {
  hasAll(section(body('bg-kafka-4#1'), '失败消息与 RocketMQ 可见性如何处理？'),
    ['不能静默跳 offset', '恢复依据', '安全前缀', '版本门槛', 'PushConsumer', 'SimpleConsumer',
      'InvisibleDuration', '重投', 'eventId', '死信', '不能把每条超配额消息都故意消费失败'], 'lag failure ownership');
  hasAll(section(body('bg-kafka-4#1'), '追问：不用 MQ，能否先缓解过载？'),
    ['令牌/信号量', '有界线程池', '请求合并', '批量写', '条件更新', '合适索引', '缩短事务',
      '写合并与分片', '连接池大不等于吞吐高'], 'non-MQ alternatives');
});

test('73 old phrasings are consolidated into 38 visible variants with correct counts and no duplicate normalized items', () => {
  let total = 0, appendedVariants = 0;
  for (const ref of expected.questions) {
    const details = [...body(ref.stableReviewKey).matchAll(/<details class="qa-variants">([\s\S]*?)<\/details>/g)];
    if(ref.stableReviewKey==='bg-kafka-4#1'){assertKafkaCapacity(question(ref.stableReviewKey));assert.equal(details.length,2);assert.equal(details[0][0],capacity.mqOriginalVariants[0]);assert.equal(details[1][0],capacity.mqAddedVariants[0]);assert.equal([...details[1][1].matchAll(/<li>/g)].length,1);appendedVariants++;details.pop();}
    assert.equal(details.length, ref.variantsAfter ? 1 : 0, `${ref.stableReviewKey}: variants container count`);
    if (!ref.variantsAfter) continue;
    const markup = details[0][1];
    const count = Number(markup.match(/<summary>其他问法（(\d+)）<\/summary>/)?.[1]);
    const list = [...markup.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m => visible(m[1]));
    assert.equal(count, ref.variantsAfter);
    assert.equal(list.length, count);
    const normalized = list.map(s => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''));
    assert.equal(new Set(normalized).size, normalized.length, `${ref.stableReviewKey}: duplicate synonym spelling`);
    total += count;
  }
  assert.equal(expected.questions.reduce((n, q) => n + q.variantsBefore, 0), 73);
  assert.equal(total, 38);
  assert.equal(appendedVariants,1);assert.equal(total+appendedVariants,39);
});

test('compound variants keep unique subquestions and point off-topic topics to exact canonical answers', () => {
  const details = key => body(key).match(/<details class="qa-variants">([\s\S]*?)<\/details>/)?.[1] ?? '';
  hasAll(visible(details('bg-kafka-3#0')), ['自动提交', '重复消费', '漏掉业务', 'DMA', '推拉模型', '存量数据', 'Rebalance', '用户 ID', '分片哈希映射'], 'order related questions');
  hasAll(details('bg-kafka-3#0'), ['#/e/bg-kafka-1/3', '#/e/bg-kafka-2/2', '#/e/bg-kafka-4/2',
    '#/e/own-mq-kafka/q-own-mq-rebalance-ownership', '#/e/own-mq-kafka/q-own-mq-offset-contract'], 'order target links');
  hasAll(visible(details('bg-rabbitmq-3#1')), ['固定档位', 'ZSet', 'Redis 过期监听', '任意精度',
    'Kafka 生产者', '十分钟', '重复领取', '批量发券', 'Quartz', '审批超时'], 'delay subquestions');
  hasAll(details('bg-kafka-4#1'), ['#/e/bg-rocketmq-3/1', '#/e/own-distributed-ch08/q-own-distributed-coupon-rights'], 'delayed coupon links');
  hasAll(details('bg-rocketmq-3#2'), ['#/e/own-distributed-ch04/q-own-distributed-seata-contract',
    '#/e/own-mq-reliability/q-own-mq-propagation-transactions'], 'distributed transaction comparisons');
});

test('all 52 internal link occurrences match the reviewed routes and resolve to real final entries/questions', async () => {
  const all = [];
  for (const ref of expected.questions) {
    const actual = internalLinks(body(ref.stableReviewKey));
    assert.deepEqual(actual, ref.internalLinks, `${ref.stableReviewKey}: reviewed links changed`);
    all.push(...actual);
  }
  assert.equal(all.length, 52);
  assert.equal(new Set(all).size, expected.expectedUniqueInternalRoutes);
  assert.equal(expected.expectedUniqueInternalRoutes, 28);
  for (const href of new Set(all)) {
    const match = /^#\/e\/([^/]+)(?:\/([^/]+))?$/.exec(href);
    assert.ok(match, `Not a stable entry/question link: ${href}`);
    const [, entryId, idOrIndex] = match;
    const entry = await loadEntry(entryId);
    if (idOrIndex === undefined) continue;
    const index = /^\d+$/.test(idOrIndex)
      ? Number(idOrIndex) : entry.items?.findIndex(q => q.id === idOrIndex);
    assert.ok(Number.isSafeInteger(index) && index >= 0 && index < entry.items.length, `Unresolved actual target: ${href}`);
    const listed = catalogById.get(entryId).items[index];
    assert.ok(listed, `Target missing at same catalog index: ${href}`);
    if (!/^\d+$/.test(idOrIndex)) {
      assert.equal(entry.items[index].id, idOrIndex);
      assert.equal(listed.id, idOrIndex);
    }
  }
});
