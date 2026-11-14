import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mergeKnowledgeLibrary} from '../scripts/knowledge-library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [];
const result = await mergeKnowledgeLibrary(entries, path.join(root, 'content', 'knowledge-library'));
const byId = new Map(entries.map((entry) => [entry.id, entry]));

test('knowledge library imports all exam points and documents', () => {
  assert.equal(entries.length, 30);
  assert.equal(result.report.documents, 25);
  assert.equal(result.report.backendPoints, 270);
  assert.equal(result.report.agentPoints, 105);
  assert.equal(result.report.topBackend, 40);
  assert.equal(result.report.topAgent, 40);
  assert.deepEqual(result.report.unmatchedTop, []);
  const map = byId.get('interview-map').html;
  const backendTop = map.slice(map.indexOf('id="kb-backend-top"'), map.indexOf('id="kb-agent-top"'));
  assert.equal((backendTop.match(/双指针同向|链表指针重排|LRU\/LFU 缓存设计|树形 DP|排序算法与复杂度|图与网格搜索/g) || []).length, 0);
  assert.ok(backendTop.includes('手写 SQL'));
  assert.ok(backendTop.includes('联合索引与最左前缀'));
  assert.ok(map.includes('#/e/algo-handwrite-board'));
  assert.ok((map.match(/class="kb-point"/g) || []).length < 375);
  assert.ok((map.match(/class="kb-point"/g) || []).length > 300);
  const route = byId.get('kb-interview-routes').html;
  for (const id of ['route-mysql', 'route-redis', 'route-kafka']) assert.ok(route.includes('id="' + id + '"'), id);
  assert.ok(route.includes('points * 10^10'));
  assert.ok(route.includes('不要拿去扣库存'));
  assert.ok(!route.includes('想屁吃') && !route.includes('拍马屁'));
  assert.ok(byId.get('kb-mysql').html.includes('#/e/kb-interview-routes/route-mysql'));
  assert.ok(byId.get('kb-mq').html.includes('#/e/kb-interview-routes/route-kafka'));
});

test('knowledge chapters carry the full interview answer, not just a jump link', () => {
  assert.equal(result.report.enriched, 369);
  assert.equal(result.report.libraryLinks, 369);
  assert.equal(result.report.examLinks, 6);
  for (const point of result.exam.points.filter((p) => p.target.kind === 'enriched')) {
    const target = byId.get(point.target.entry);
    const at = target.html.indexOf('id="' + point.target.anchor + '"');
    const endDetails = target.html.indexOf('</details>', at);
    const endSection = target.html.indexOf('</section>', at);
    const end = [endDetails, endSection].filter((index) => index > at).sort((a,b) => a - b)[0];
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

test('supplement cards follow headings and top points avoid auxiliary sections', () => {
  for (const model of result.models.values()) {
    assert.equal((model.html.match(/<h[2-6][^>]*>\s*<details class="kb-supplement"/g) || []).length, 0, model.id + ': card inside heading');
    assert.equal((model.html.match(/来源档案（原始文件/g) || []).length, 0, model.id + ': source archive published');
    assert.equal((model.html.match(/不是孤立概念/g) || []).length, 0, model.id + ': template supplement');
  }
  for (const row of [...result.exam.tops.backend, ...result.exam.tops.agent]) {
    if (row.title.includes('多态与虚函数表')) {
      assert.equal(row.point.target.entry, 'exam-backend-detail');
      continue;
    }
    assert.equal(row.point.target.kind, 'enriched', row.title);
    assert.ok(!/来源档案|参考资料|速记|图解补充|讲解视频|面试问题|常见误区/.test(row.point.target.heading || ''), row.title + ' -> ' + row.point.target.heading);
  }
  assert.ok(byId.get('exam-study-guide').html.includes('看起来会、一问就崩'));
  for (const model of result.models.values()) {
    assert.equal((model.html.match(/id="kb-gap-[^"]*-other"/g) || []).length, 0, model.id + ': unclassified gap');
  }
  const placed = (title) => {
    const point = result.exam.points.find((item) => item.title === title);
    assert.ok(point, 'missing point ' + title);
    return point;
  };
  const expectPlace = (title, entry, heading) => {
    const point = placed(title);
    assert.equal(point.target.entry, entry, title);
    assert.equal(point.target.heading, heading, title + ' -> ' + point.target.heading);
  };
  expectPlace('LRU 缓存（HashMap + 双向链表）', 'kb-algorithm', '缓存设计题');
  expectPlace('LRU / LFU 缓存设计', 'kb-algorithm', '缓存设计题');
  expectPlace('LRU/LFU 缓存设计（TTL、泛型、线程安全）', 'kb-algorithm', '缓存设计题');
  expectPlace('基本类型与包装类缓存池', 'kb-javase', '语言契约');
  expectPlace('本地缓存与多级缓存（Caffeine 选型、容量估算）', 'kb-redis', '缓存与失效');
  expectPlace('高并发瓶颈、容量与线上排查', 'kb-redis', '容量与排查');
  expectPlace('物理内存分配、malloc 与 OOM', 'kb-os', '操作系统与 Linux');
  expectPlace('手写 SQL（深分页/排名/分组/upsert）', 'kb-mysql', '索引、事务与容量');
  expectPlace('#{} 与 ${} 区别及 SQL 注入防护', 'kb-spring', 'Spring 与 ORM');
  expectPlace('语义切分与父子块索引', 'kb-rag', '检索工程');
  expectPlace('滑动窗口（变长/定长 + 限流窗口）', 'kb-algorithm', '滑动窗口');
  expectPlace('滑动窗口（无重复最长子串/最小覆盖子串/窗口最大值）', 'kb-algorithm', '滑动窗口');
  expectPlace('双指针·贪心·单调栈（三数之和/接雨水/柱状图/组成小于 n 的最大数）', 'kb-algorithm', '双指针、贪心与单调栈');
  expectPlace('字符串解析与大数运算（压缩解码/atoi/IP/大数加减乘）', 'kb-algorithm', '字符串与大数');
  expectPlace('线程共享/独有资源、伪共享与缓存局部性', 'kb-os', '什么是缓存局部性');
  expectPlace('Kafka 高吞吐原理：顺序写 / 页缓存 / 零拷贝 / 批量压缩', 'kb-mq', 'Kafka的高吞吐原理');
  const cacheConsistency = placed('缓存与 DB 一致性：删除时序与多级缓存');
  assert.equal(cacheConsistency.target.entry, 'kb-redis');
  assert.match(cacheConsistency.target.heading, /缓存/);
});

test('the exam source remains checked in for deterministic rebuilds', async () => {
  const source = await readFile(path.join(root, 'content', 'knowledge-library', 'exam-map.md'), 'utf8');
  assert.ok(source.includes('后端 + Agent 面试考点分布与高频知识点'));
  assert.ok(source.split('\n').length > 4600);
});
