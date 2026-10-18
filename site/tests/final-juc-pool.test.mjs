import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Once installed under SITE/tests, the defaults need no workspace-specific paths.
const site = process.env.JUC_POOL_SITE_ROOT
  ? path.resolve(process.env.JUC_POOL_SITE_ROOT)
  : fileURLToPath(new URL('../', import.meta.url));
const candidate = process.env.JUC_POOL_CANDIDATE_DIR
  ? path.resolve(process.env.JUC_POOL_CANDIDATE_DIR) : null;
const expected = JSON.parse(await readFile(new URL('./final-juc-pool/expected.json', import.meta.url), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const entries = new Map();
for (const name of await readdir(path.join(site, 'dist/data/chapters'))) {
  if (!name.endsWith('.json')) continue;
  for (const entry of (await readJson(path.join(site, 'dist/data/chapters', name))).entries) {
    assert.ok(!entries.has(entry.id), 'unique built entry ' + entry.id);
    entries.set(entry.id, entry);
  }
}
if (candidate) {
  const records = (await readJson(path.join(candidate, 'records.json'))).records;
  assert.equal(records.length, 2);
  const entryBefore = structuredClone(entries.get(expected.theoryEntryId));
  const entryAfter = structuredClone(entryBefore);
  for (const record of records) {
    assert.equal(record.entryId, expected.theoryEntryId);
    assert.equal(record.questionId, expected.questionId);
    assert.deepEqual(record.path.slice(0, 2), ['items', expected.index]);
    assert.ok(['a', 'lead'].includes(record.path[2]));
    const item = entryAfter.items[expected.index];
    const field = record.path[2];
    assert.equal(item[field], record.before);
    assert.equal(sha(record.before), record.beforeSha256);
    assert.equal(sha(record.after), record.afterSha256);
    item[field] = record.after;
  }
  const restored = structuredClone(entryAfter);
  restored.items[expected.index].a = entryBefore.items[expected.index].a;
  restored.items[expected.index].lead = entryBefore.items[expected.index].lead;
  assert.deepEqual(restored, entryBefore, 'only a/lead change; all identities and siblings preserved');
  entries.set(expected.theoryEntryId, entryAfter);
  const addition = await readJson(path.join(candidate, 'authoring/entries/own-practice-juc-bounded-pool.json'));
  const {compileUnextendedAuthoring} = await import(pathToFileURL(path.join(site, 'scripts/authoring.mjs')));
  const originals = [...entries.values()];
  const identity = {entries: originals.map(e => ({id:e.id, kind:e.kind, progressKey:e.progressKey || e.id}))};
  const compiled = compileUnextendedAuthoring(originals,
    [{type:'entries', file:'own-practice-juc-bounded-pool.json', data:addition}], identity);
  entries.set(addition.id, compiled.find(e => e.id === addition.id));
}
const item = entries.get(expected.theoryEntryId)?.items[expected.index];
const practice = entries.get(expected.practiceId);
const decode = text => text.replace(/&(?:lt|gt|quot|apos|amp|#39);/g,
  entity => ({'&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&amp;':'&'})[entity]);
const sources = new Map();
for (const resource of expected.resources) {
  const source = candidate
    ? path.join(candidate, 'resources', resource.name)
    : path.join(site, 'public/assets/examples/juc-bounded-pool', resource.name);
  sources.set(resource.name, await readFile(source));
}

test('JUC bounded-pool answer preserves identity, final fields and seven grouped question forms', () => {
  assert.equal(item.id, expected.questionId);
  assert.equal(item.q, expected.question);
  assert.equal(sha(item.a), expected.after.a);
  assert.equal(sha(item.lead), expected.after.lead);
  assert.equal(entries.get(expected.theoryEntryId).items.length, expected.itemCount);
  assert.deepEqual(entries.get(expected.theoryEntryId).items.map(x => x.id), expected.siblingIds);
  assert.ok(item.a.startsWith('<p class="md-p">我会先把线程池设计成一个有容量上限的任务状态机'));
  assert.ok(!/<pre\b|<code\b/.test(item.a), 'theory is not an implementation dump');
  assert.ok(!/code\/BoundedPool\.java|16 手写|OS\/Linux：|Q21|改进设计.*应|来源|本批|修订/.test(item.a));
  const details = item.a.match(/<details class="qa-variants">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(details, 'one variants grouping');
  assert.equal((details.match(/<li>/g) || []).length, 3);
  for (const variant of expected.variants) assert.ok(details.includes('“' + variant + '”'), variant);
  const practiceLink = '#/e/' + expected.practiceId;
  assert.ok(item.a.indexOf(practiceLink) < item.a.indexOf('可选反例'), 'correct practice precedes optional bad pattern');
  for (const required of ['线性化点', '锁外执行', 'FutureTask', '已经出队', 'false', 'alive', 'finally',
      '普通任务异常', '中断标记', 'maximumPoolSize', '核心线程', '无界队列', 'AbortPolicy',
      'CallerRunsPolicy', '事件循环', '业务锁', 'CPU', 'I/O', '连接数', '拒绝数', '排队与执行耗时']) {
    assert.ok(item.a.includes(required), 'unique detail retained: ' + required);
  }
});

test('JUC bounded-pool practice is a runnable code entry with stable inbound and outbound links', () => {
  assert.ok(practice, 'actual compiled practice exists');
  assert.equal(practice.mod, 'code');
  for (const id of expected.practiceSections) assert.ok(practice.html.includes('id="' + id + '"'));
  const bodies = item.a + practice.html;
  for (const match of bodies.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"/]+))?"/g)) {
    const target = entries.get(match[1]);
    assert.ok(target, 'target entry exists: ' + match[1]);
    if (match[2]) assert.ok(target.items?.some((q, i) => (q.id || String(i)) === match[2]), 'target question exists');
  }
  for (const resource of expected.resources.filter(x => x.name !== 'README.md')) {
    assert.ok(practice.html.includes('href="assets/examples/juc-bounded-pool/' + resource.name + '" download'));
  }
  const code = [...practice.html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)]
    .map(m => decode(m[1])).filter(x => x.includes('public final class BoundedPoolTeaching'));
  assert.equal(code.length, 1);
  assert.equal(code[0], sources.get('BoundedPoolTeaching.java').toString('utf8'), 'visible/download source parity');
});

test('JUC bounded-pool downloads have reviewed hashes and public/dist parity', async () => {
  for (const resource of expected.resources) {
    const bytes = sources.get(resource.name);
    assert.equal(sha(bytes), resource.sha256, resource.name);
    if (!candidate) assert.deepEqual(bytes,
      await readFile(path.join(site, 'dist/assets/examples/juc-bounded-pool', resource.name)), resource.name + ' built parity');
  }
});

test('JUC bounded-pool original startup checks and ownership/termination contracts run with finite bounds', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'juc-pool-portable-'));
  try {
    const java = process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
    const run = args => {
      const result = spawnSync(java, args, {encoding:'utf8', timeout:30000, maxBuffer:2*1024*1024});
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result.stdout;
    };
    const files = [];
    for (const name of ['Checks.java', 'BoundedPoolTeaching.java', 'BoundedPoolStartupTest.java', 'BoundedPoolContractTest.java']) {
      const file = path.join(work, name); await writeFile(file, sources.get(name)); files.push(file);
    }
    run(['-m','jdk.compiler/com.sun.tools.javac.Main','-source','21','-target','21','-encoding','UTF-8','-d',work,...files]);
    assert.match(run(['-cp',work,'BoundedPoolStartupTest']), /BoundedPoolStartupTest OK: registration\/start\/post-start/);
    assert.match(run(['-cp',work,'BoundedPoolContractTest']), /BoundedPoolContractTest OK: interrupt\/await\/dequeue\/TPE\/CallerRuns/);
  } finally { await rm(work, {recursive:true, force:true}); }
});
