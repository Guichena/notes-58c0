import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Copy this file to tests/ and its sibling fixtures subtree alongside it.
// The override supports running the same candidate before copying it into a site.
const dist = process.env.JAVA_STRING_SEMANTIC_DIST
  ? path.resolve(process.env.JAVA_STRING_SEMANTIC_DIST)
  : path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const fixtureRoot = new URL('./fixtures/java-string-semantic/', import.meta.url);
const expected = JSON.parse(await readFile(new URL('expected.json', fixtureRoot), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(dist, 'data/catalog.json'), 'utf8'));
const catalogById = new Map(catalog.entries.map(e => [e.id, e]));
const sha = value => createHash('sha256').update(value).digest('hex');
const chunks = new Map();

async function loadEntry(id) {
  const meta = catalogById.get(id);
  assert.ok(meta, `Missing entry in final catalog: ${id}`);
  assert.equal(typeof meta._chunk, 'string', `Missing actual chapter path: ${id}`);
  const chapterPath = path.resolve(dist, meta._chunk);
  assert.ok(chapterPath.startsWith(dist + path.sep), `Chapter escapes dist: ${meta._chunk}`);
  if (!chunks.has(chapterPath)) {
    chunks.set(chapterPath, JSON.parse(await readFile(chapterPath, 'utf8')));
  }
  const entry = chunks.get(chapterPath).entries.find(e => e.id === id);
  assert.ok(entry, `Catalog target not found in actual final chapter: ${id}`);
  return entry;
}

const canonicalEntry = await loadEntry('own-java-strings-generics');
const jvmEntry = await loadEntry('q-own-jvm-memory');
const canonical = canonicalEntry.items[0];
const jvm = jvmEntry.items[2];
const decode = text => text
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const visible = text => decode(text.replace(/<[^>]*>/g, ''));
const hasAll = (text, fragments, label) => {
  for (const fragment of fragments) assert.ok(text.includes(fragment), `${label}: missing ${fragment}`);
};
const section = (html, title) => {
  const headings = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];
  const position = headings.findIndex(h => visible(h[1]) === title);
  assert.notEqual(position, -1, `Missing canonical section: ${title}`);
  const heading = headings[position];
  return visible(html.slice(heading.index + heading[0].length,
    headings[position + 1]?.index ?? html.length));
};
const links = body => [...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m => decode(m[1]));

test('final dist keeps the two stable question IDs, exact indices and sibling identities', () => {
  for (const [entry, reference] of [[canonicalEntry, expected.entries[0]], [jvmEntry, expected.entries[1]]]) {
    assert.equal(entry.id, reference.entryId);
    assert.deepEqual(entry.items.map(q => q.id), reference.itemIds);
    assert.equal(entry.items.length, reference.itemIds.length);
    assert.equal(entry.items[reference.questionIndex].id, reference.questionId);
    assert.deepEqual(catalogById.get(entry.id).items.map(q => q.id), reference.itemIds);
    assert.equal(`#/e/${entry.id}/${entry.items[reference.questionIndex].id}`, reference.stableRoute);
  }
  assert.equal(canonicalEntry.items[2].id, 'q-own-java-generics-pecs');
});

test('actual final chapter titles, short answers and full bodies match the reviewed six fields', () => {
  const actual = new Map([[canonicalEntry.id, canonicalEntry], [jvmEntry.id, jvmEntry]]);
  for (const field of expected.fields) {
    const item = actual.get(field.entryId).items[field.index];
    assert.equal(sha(item[field.field]), field.sha256,
      `Final rendered payload differs: ${field.entryId}[${field.index}].${field.field}`);
    if (field.field === 'q') assert.equal(item.q, field.text);
  }
});

test('identity and object-count conditions live in the canonical final answer, including incomplete-code boundaries', () => {
  const identity = section(canonical.a, '先看完整声明：同样加空字符串，为什么结果不同？');
  hasAll(identity, ['String s1 = "abc"', 'String s2 = new String("abc")', 'String s3 = s1 + ""',
    's1 == s2 和 s1 == s3 都是 false', '三者的内容却相等', '底层数组可能共享',
    '内容相等的 String 的 hashCode 相同', 'identityHashCode 也可能碰撞',
    '"a" + "b"', 'final String s1 = "abc"', 'final String s1 = new String("abc")',
    'final String s1 = load()', 'effectively final', '可观察的比较结果',
    '变量声明', 'new 的参数', '比较对象', '待打印变量的赋值'], 'identity');
  const count = section(canonical.a, '“创建几个对象”先确定哪四个计数条件？');
  hasAll(count, ['完整表达式', '字面量是否已存在', '底层数组与辅助对象', '语言语义',
    '物理分配', '新增一个', '两次 new', '== 为 false，equals 为 true',
    'String str = "string"', '无参 new String()', '不可观察分配的消除'], 'count');
});

test('intern and HotSpot lifetime details are located in the canonical answer, with explicit version and retention conditions', () => {
  const intern = section(canonical.a, 'intern 返回谁，为什么调用后原变量可能没变？');
  hasAll(intern, ['按 equals', '已有对象', '当前字符串作为规范表示', 's2.intern() == s1 为 true',
    '不接收返回值', 's2 仍指向原来的 new 对象', '其他类',
    '不代表每个 new String 或运行期拼接结果都会自动驻留'], 'intern');
  const lifetime = section(canonical.a, '常量池在哪里，驻留后的字符串会一直存活吗？');
  hasAll(lifetime, ['class 文件常量池', '运行时常量池', '字符串驻留结构', '类或接口',
    'String 实例及内容数组在堆中', '查找表另行管理', '元空间',
    'HotSpot 21', '动态驻留表', '可清理的弱句柄', '没有其他保留路径',
    '已加载类的常量关联', '静态字段', '业务缓存', 'null', '不保证立即回收',
    '实际可达性和引用强度'], 'lifetime');
});

test('canonical storage section retains modified UTF-8, u2, code-unit, code-point and grapheme boundaries', () => {
  const storage = section(canonical.a, '底层编码、length 和最大长度为什么是三回事？');
  hasAll(storage, ['OpenJDK 8', 'char[]', 'JDK 9', 'Compact Strings', 'byte[] 加 coder',
    'Latin-1', 'UTF-16', '不是统一改成 UTF-8', '"A😀".length() 是 3 个代码单元',
    '码点数是 2', '一个用户感知字符还可能含多个码点', '字素簇规则',
    'CONSTANT_Utf8', 'u2 length', '65535 个修改版 UTF-8 字节', '不是 65535 个字符',
    '具体代码和编译结果', 'Integer.MAX_VALUE', '底层数组、编码方式与可用内存'], 'storage');
});

test('canonical immutability, builder synchronization and engineering tradeoffs preserve their original conditions', () => {
  const immutable = section(canonical.a, 'String 为什么不可变，变量重新赋值算修改吗？');
  hasAll(immutable, ['公开 API 原地修改', 'final 类', '可写别名', '防御性复制',
    '挡不住修改数组元素', 's2 += "world"', 's1 仍是 "hello"',
    "chars[0] = 'x'", 's 仍是 "ab"', '缓存 hashCode', '反复修改可能增加分配'], 'immutable');
  const tradeoff = section(canonical.a, '拼接怎样选工具，哪些优化需要先看场景？');
  hasAll(tradeoff, ['StringBuilder 可变且不保证并发安全', '线程独占', 'StringBuffer',
    '单次操作', '多步组合并不自动原子', '局部 builder', '反复复制前缀',
    '少量表达式不必机械改写', 'invokedynamic', '有界、重复率高', '引用寿命',
    '分配证据', '高基数、任意外部输入', '无限缓存', 'equals',
    '其他组件意外共享监视器', '私有专用锁对象'], 'tradeoff');
});

test('JVM question is a concise memory guide and all seven cross-links across both questions resolve to actual built questions', async () => {
  const text = visible(jvm.a);
  hasAll(text, ['class 文件常量池', '运行时常量池', '字符串驻留结构',
    'String str = new String("123")', '若 str 是方法内的局部变量',
    'HotSpot 21', '弱句柄', '业务缓存', '不承诺立即回收'], 'JVM guide');
  assert.ok(text.length < visible(canonical.a).length / 3, 'JVM guide must not repeat the whole canonical answer');
  assert.ok(!jvm.a.includes('String s1 = "abc"; String s2 ='), 'Full identity example duplicated into JVM guide');
  assert.ok(links(jvm.a).includes('#/e/own-java-strings-generics/q-own-java-string-intern'));
  const actualLinks = [...new Set([...links(canonical.a), ...links(jvm.a)])].sort();
  assert.equal(actualLinks.length, 7);
  assert.deepEqual(actualLinks, [...expected.routes].sort());
  for (const route of actualLinks) {
    const match = /^#\/e\/([^/]+)\/([^/]+)$/.exec(route);
    assert.ok(match, `Not a stable question route: ${route}`);
    const [, entryId, questionId] = match;
    const entry = await loadEntry(entryId);
    const index = entry.items.findIndex(q => q.id === questionId);
    assert.ok(index >= 0, `Missing actual final target: ${route}`);
    assert.equal(catalogById.get(entryId).items[index].id, questionId,
      `Catalog/chapter index mismatch: ${route}`);
  }
});

test('final presentation removes orphan prompt fragments and duplicate labels while retaining complete grouped questions', () => {
  for (const question of [canonical, jvm]) {
    assert.doesNotMatch(question.a, /<li>\s*(第三个一定 true 吗|给定代码打印 b 是什么|打印变量 b|上述代码创建几个对象)\s*<\/li>/);
    assert.doesNotMatch(question.a, /<h3[^>]*>标签<\/h3>/);
    assert.doesNotMatch(question.a, /其他问法（27）/);
  }
  assert.ok(canonical.a.includes('<summary>分层追问（7）</summary>'));
  hasAll(visible(canonical.a), ['PriorityQueue 的底层实现与优先级', 'Queue 的常用方法与失败语义',
    '嵌套 try 中的异常传播', 'try 和 finally 都 return 时的结果'], 'routed mixed questions');
});

test('the current reviewed Java fixture compiles afresh and executes all 15 semantic assertions', async t => {
  const sourcePath = fileURLToPath(new URL('StringSemanticChecks.java', fixtureRoot));
  const source = await readFile(sourcePath);
  assert.equal(sha(source), expected.javaFixtureSha256, 'Java fixture changed without review');
  const parent = process.env.JAVA_STRING_SEMANTIC_TMPDIR
    ? path.resolve(process.env.JAVA_STRING_SEMANTIC_TMPDIR) : tmpdir();
  await mkdir(parent, {recursive: true});
  const work = await mkdtemp(path.join(parent, 'java-string-semantic-'));
  const java = process.env.JAVA || 'java';
  const run = (args, label) => {
    const result = spawnSync(java, args, {encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024});
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${label}: ${result.stdout}\n${result.stderr}`);
    return result.stdout + result.stderr;
  };
  try {
    const version = run(['-version'], 'Java runtime');
    run(['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-d', work, sourcePath], 'fresh Java compilation');
    const output = run(['-cp', work, 'StringSemanticChecks'], 'current Java fixture');
    const lines = output.trim().split(/\r?\n/);
    assert.equal(lines.length, 16, output);
    assert.equal(lines.filter(line => line.startsWith('PASS ') && !line.startsWith('PASS total=')).length, 15);
    assert.equal(lines.at(-1), 'PASS total=15');
    t.diagnostic(`Fresh fixture SHA-256 ${sha(source)}; ${version.split(/\r?\n/)[0]}; PASS total=15`);
    t.diagnostic(output.trim());
  } finally {
    await rm(work, {recursive: true, force: true});
  }
});
