import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mergeKnowledgeLibrary} from '../scripts/knowledge-library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [];
const result = await mergeKnowledgeLibrary(entries, path.join(root, 'content', 'knowledge-library'));
const byId = new Map(entries.map((entry) => [entry.id, entry]));

test('knowledge library imports all exam points and documents', () => {
  assert.equal(entries.length, 28);
  assert.equal(result.report.documents, 25);
  assert.equal(result.report.backendPoints, 270);
  assert.equal(result.report.agentPoints, 105);
  assert.equal(result.report.topBackend, 40);
  assert.equal(result.report.topAgent, 40);
  assert.deepEqual(result.report.unmatchedTop, []);
  assert.equal((byId.get('interview-map').html.match(/class="kb-point"/g) || []).length, 375);
});

test('knowledge chapters carry the full interview answer, not just a jump link', () => {
  assert.equal(result.report.enriched, 369);
  assert.equal(result.report.libraryLinks, 369);
  assert.equal(result.report.examLinks, 6);
  for (const point of result.exam.points.filter((p) => p.target.kind === 'enriched')) {
    const target = byId.get(point.target.entry);
    const at = target.html.indexOf('id="' + point.target.anchor + '"');
    const end = target.html.indexOf('</details>', at);
    assert.ok(at >= 0 && end > at, point.title + ': missing supplement');
    const card = target.html.slice(at, end);
    const escapedSummary = point.summary.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    assert.ok(card.includes(escapedSummary), point.title + ': missing conclusion');
    for (const label of ['本质','必答','高频追问','易错点']) {
      if (point.body.includes(label)) assert.ok(card.includes(label), point.title + ': missing ' + label);
    }
  }
});

test('every exam-point route resolves to a real anchor in a loaded entry', () => {
  for (const point of result.exam.points) {
    const target = byId.get(point.target.entry);
    assert.ok(target, point.title + ': missing target entry');
    assert.ok(target.html.includes('id="' + point.target.anchor + '"'), point.title + ': missing target anchor');
  }
  for (const row of [...result.exam.tops.backend, ...result.exam.tops.agent]) {
    assert.ok(row.point, row.title + ': top row is not linked to its detail');
  }
});

test('all imported image references resolve to checked-in public assets', async () => {
  let count = 0;
  for (const entry of entries) {
    for (const match of entry.html.matchAll(/<img class="kb-image" src="([^"]+)"/g)) {
      if (/^https?:\/\//.test(match[1])) continue;
      count += 1;
      await access(path.join(root, 'public', match[1]));
    }
  }
  assert.equal(count, 164);
});

test('each source document keeps all headings, diagrams and code fences', () => {
  for (const [id, model] of result.models) {
    let inFence = false;
    const sourceHeadings = model.markdown.split('\n').filter((line) => {
      const cleaned = line.replace(/^>\s?/, '').trim();
      if (/^```/.test(cleaned)) { inFence = !inFence; return false; }
      return !inFence && /^#{2,6}\s+/.test(cleaned);
    });
    const actualHeadings = new Set(model.toc.map((heading) => heading.text.replace(/[*`]/g,'')));
    for (const heading of sourceHeadings) {
      const text = heading.replace(/^>\s?/, '').trim().replace(/^#{2,6}\s+/, '').replace(/[*`]/g,'');
      assert.ok(actualHeadings.has(text), id + ': missing heading ' + text);
    }
    const sourceFences = model.markdown.split('\n').filter((line) => /^```/.test(line.replace(/^>\s?/, '').trim())).length / 2;
    const htmlBlocks = (model.html.match(/class="code-card md-code-card"/g) || []).length + (model.html.match(/class="sd-mmd"/g) || []).length;
    assert.equal(htmlBlocks, sourceFences, id + ': fenced block count');
    const sourceImages = [...model.original.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].length;
    const htmlImages = (model.html.match(/<img class="kb-image"/g) || []).length;
    assert.equal(htmlImages, sourceImages, id + ': image count');
  }
});

test('technical supplements are unique per exam point', async () => {
  const backend = JSON.parse(await readFile(path.join(root, 'content', 'knowledge-supplements', 'backend.json'), 'utf8'));
  const agent = JSON.parse(await readFile(path.join(root, 'content', 'knowledge-supplements', 'agent.json'), 'utf8'));
  const rows = [...backend, ...agent];
  assert.equal(rows.length, 375);
  assert.equal(backend.length, 270);
  assert.equal(agent.length, 105);
  const ids = new Set(rows.map(r => r.id));
  assert.equal(ids.size, 375);
  const hashes = new Set(rows.map(r => createHash('sha256').update(r.mechanism + r.example + r.verification).digest('hex')));
  assert.equal(hashes.size, 375, 'all supplements must be unique');
  for (const row of rows) {
    assert.ok(row.mechanism.length >= 80, row.id + ': mechanism too short');
    assert.ok(row.example.length >= 60, row.id + ': example too short');
    assert.ok(row.verification.length >= 50, row.id + ': verification too short');
    assert.ok(/机制|执行链|状态|约束|边界|失败|并发|超时|重复|恢复|触发|资源/.test(row.mechanism), row.id + ': mechanism lacks depth');
    assert.ok(/场景|例子|请求|调试|观察|落地|排障|验证/.test(row.example), row.id + ': example lacks depth');
    assert.ok(/验证|指标|约束|边界|异常|评估|验收|量化|恢复/.test(row.verification), row.id + ': verification lacks depth');
  }
});

test('the exam source remains checked in for deterministic rebuilds', async () => {
  const source = await readFile(path.join(root, 'content', 'knowledge-library', 'exam-map.md'), 'utf8');
  assert.ok(source.includes('后端 + Agent 面试考点分布与高频知识点'));
  assert.ok(source.split('\n').length > 4600);
});
