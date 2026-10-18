import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Copied to SITE/tests this needs no override. The override permits reviewing this
// candidate against a read-only site without installing it or writing its files.
const root = process.env.FINAL_PRACTICE_SITE_ROOT
  ? path.resolve(process.env.FINAL_PRACTICE_SITE_ROOT)
  : fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = fileURLToPath(new URL('./final-practice-io/', import.meta.url));
const read = relative => readFile(path.join(root, relative), 'utf8');
const fixture = name => readFile(path.join(fixtureRoot, name), 'utf8');
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const runJava = (args, options = {}) => execFileSync(java, args, {
  encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, ...options,
});
const compilerArgs = (out, files) => [
  '-Duser.language=en', '-m', 'jdk.compiler/com.sun.tools.javac.Main',
  '-encoding', 'UTF-8', '-d', out, ...files,
];
const decode = text => text.replace(/&(?:lt|gt|quot|apos|amp|#x[0-9a-f]+|#\d+);/gi, entity => {
  const named = {'&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'", '&amp;':'&'};
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const number = entity.slice(2, -1);
  return String.fromCodePoint(number[0].toLowerCase() === 'x'
    ? Number.parseInt(number.slice(1), 16) : Number.parseInt(number, 10));
});
const codeText = body => decode(body.replace(/^\s*<code\b[^>]*>([\s\S]*)<\/code>\s*$/, '$1'));
const javaBlocks = html => [...html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)]
  .filter(m => /data-lang=["']java["']/.test(m[1]) || /^\s*<code\b[^>]*class=["'][^"']*\blanguage-java\b/.test(m[2]))
  .map(m => codeText(m[2]));
const cards = html => [...html.matchAll(/<span class="file-label">([\s\S]*?)<\/span>[\s\S]*?<pre\b[^>]*>([\s\S]*?)<\/pre>/g)]
  .map(m => ({label:decode(m[1]), code:codeText(m[2])}));
const publicClass = name => new RegExp('public\\s+(?:(?:final|abstract)\\s+)?class\\s+' + name + '\\b');
const catalog = JSON.parse(await read('dist/data/catalog.json'));
const entries = new Map();
for (const chunk of new Set(catalog.entries.map(e => e._chunk))) {
  assert.ok(chunk.startsWith('data/chapters/') && !chunk.includes('..'), 'safe catalog chunk');
  for (const entry of JSON.parse(await read('dist/' + chunk)).entries) {
    assert.ok(!entries.has(entry.id), 'unique built entry ' + entry.id);
    entries.set(entry.id, entry);
  }
}
function field(id, keys) {
  let result = entries.get(id);
  assert.ok(result, 'actual built entry exists: ' + id);
  for (const key of keys) result = result[key];
  assert.equal(typeof result, 'string', 'actual built string field: ' + id + ' ' + keys.join('.'));
  return result;
}
async function workFor(name, body) {
  const work = await mkdtemp(path.join(tmpdir(), 'final-practice-' + name + '-'));
  try { return await body(work); }
  finally { await rm(work, {recursive:true, force:true}); }
}
const sourceNames = ['DeadlockExamples.java', 'TransferContractTest.java', 'OsExamples.java'];
async function sourcesFromBuild() {
  const sources = {};
  for (const name of sourceNames) {
    const relative = 'assets/examples/final-practice-io/' + name;
    const built = await read('dist/' + relative);
    assert.equal(await read('public/' + relative), built, 'public/dist exact resource bytes: ' + name);
    assert.match(built, publicClass(name.slice(0, -5)), 'resource has expected public class');
    sources[name] = built;
  }
  return sources;
}

test('final practice downloads exist, match dist, and are linked from the actual final answers', async () => {
  const sources = await sourcesFromBuild();
  const links = [
    ['hw-transfer-locking', ['answerHtml'], 'DeadlockExamples.java'],
    ['hw-transfer-locking', ['answerHtml'], 'TransferContractTest.java'],
    ['own-juc-diagnostics', ['items', 0, 'a'], 'DeadlockExamples.java'],
    ['new-systems-os-endian-code', ['answerHtml'], 'OsExamples.java'],
    ['new-systems-os-tail-follow', ['answerHtml'], 'OsExamples.java'],
  ];
  for (const [id, keys, name] of links) {
    assert.ok(field(id, keys).includes('href="assets/examples/final-practice-io/' + name + '" download'), id + ' download ' + name);
  }
  const displayed = javaBlocks(field('hw-transfer-locking', ['answerHtml']))
    .filter(code => publicClass('TransferContractTest').test(code));
  assert.equal(displayed.length, 1, 'one current displayed transfer test');
  assert.equal(displayed[0], sources['TransferContractTest.java'], 'displayed transfer test/download exact bytes');
  assert.ok(field('own-juc-diagnostics', ['items', 0, 'a']).includes('href="#/e/hw-transfer-locking"'));
});

test('actual final Scanner fragments preserve distinct same-line and next-line contracts', async t => {
  const body = field('syntax-2', ['html']);
  const blocks = javaBlocks(body);
  const same = blocks.filter(code => code.includes('// 合同 A：'));
  const next = blocks.filter(code => code.includes('// 合同 B：'));
  const whole = blocks.filter(code => code.includes('// 光标已在正文行开头；'));
  assert.equal(same.length, 1, 'one same-line contract snippet');
  assert.equal(next.length, 2, 'two synchronized next-line snippet copies');
  assert.equal(next[0], next[1], 'all repeated next-line code bytes identical');
  assert.equal(whole.length, 1, 'standalone whole-line fragment exists');
  assert.ok(!body.includes('前面读过数字时需要这一句'));
  assert.ok(!body.includes('nextLine()</code> 会读到空行'));
  let template = await fixture('ScannerLineContractTest.template');
  for (const [marker, source] of [
    ['SAME_LINE_SNIPPET', same[0]], ['NEXT_LINE_SNIPPET', next[0]], ['WHOLE_LINE_SNIPPET', whole[0]],
  ]) {
    assert.equal(template.split(marker).length, 2, 'one oracle marker ' + marker);
    template = template.replace(marker, source);
  }
  await workFor('scanner', async work => {
    const file = path.join(work, 'ScannerLineContractTest.java');
    await writeFile(file, template);
    runJava(compilerArgs(work, [file]));
    const output = runJava(['-cp', work, 'ScannerLineContractTest'], {timeout:20000});
    assert.match(output, /ScannerLineContractTest PASS: 22 checks;/);
    t.diagnostic(output.trim());
  });
});

test('actual final downloadable transfer, deadlock and OS sources compile and pass local checks', async t => {
  const sources = await sourcesFromBuild();
  await workFor('resources', async work => {
    const files = [];
    for (const [name, source] of Object.entries(sources)) {
      const file = path.join(work, name); await writeFile(file, source); files.push(file);
    }
    const smoke = path.join(work, 'DeadlockResourceSmokeTest.java');
    await writeFile(smoke, await fixture('DeadlockResourceSmokeTest.java')); files.push(smoke);
    runJava(compilerArgs(work, files));
    for (const name of ['TransferContractTest', 'DeadlockResourceSmokeTest', 'OsExamples']) {
      const output = runJava(['-cp', work, name], {timeout:25000});
      assert.match(output, /PASS/, name + ' local check');
      t.diagnostic(name + ': ' + output.trim());
    }
  });
});

const filenameCases = [
  ['hwqa-3', ['items', 0, 'a'], 'ConcurrentValueRemover', 'Main.java'],
  ['handwrite-47', ['answerHtml'], 'BasicLruCache', 'Answer.java'],
  ['handwrite-47', ['answerHtml'], 'LruByLinkedHashMap', 'Answer.java'],
  ['handwrite-58', ['answerHtml'], 'Pools', 'Answer.java'],
  ['handwrite-56', ['answerHtml'], 'MyBlockingQueue', 'Answer.java'],
  ['hwqa-2', ['items', 0, 'a'], 'OrderStatusService', 'Main.java'],
  ['hwqa-2', ['items', 1, 'a'], 'LocalMessageService', 'Main.java'],
  ['hwqa-2', ['items', 2, 'a'], 'SeckillService', 'Main.java'],
];
for (const [id, keys, name, oldLabel] of filenameCases) {
  test('actual final filename compiles: ' + id + ' ' + name + '.java', async t => {
    const matches = cards(field(id, keys)).filter(card => publicClass(name).test(card.code));
    assert.equal(matches.length, 1, 'one current code card for ' + name);
    const {label, code} = matches[0];
    assert.equal(label, name + '.java', 'actual visible filename/public class agreement');
    await workFor('filename-' + name, async work => {
      const dependencies = [];
      if (name === 'LocalMessageService') {
        const db = javaBlocks(field('database-94', ['supplementHtml']))
          .filter(source => publicClass('Db').test(source));
        assert.equal(db.length, 1, 'one current complete displayed Db dependency');
        const dbFile = path.join(work, 'Db.java'); await writeFile(dbFile, db[0]); dependencies.push(dbFile);
        assert.ok(field(id, keys).includes('href="#/e/database-94"'), 'dependency link remains reachable');
      }
      const correctFile = path.join(work, label); await writeFile(correctFile, code);
      runJava(compilerArgs(work, [correctFile, ...dependencies]));
      // The same actual code under its former label must fail for the declared
      // public class. No old proposal or stale source fixture is compiled.
      const wrongFile = path.join(work, 'wrong', oldLabel);
      await mkdir(path.dirname(wrongFile)); await writeFile(wrongFile, code);
      const wrong = spawnSync(java, compilerArgs(work, [wrongFile, ...dependencies]), {
        encoding:'utf8', timeout:60000, maxBuffer:4 * 1024 * 1024,
      });
      assert.ifError(wrong.error);
      assert.notEqual(wrong.status, 0, 'former filename reproduces compilation failure');
      assert.ok(wrong.stderr.includes('should be declared in a file named ' + name + '.java'), wrong.stderr);
      t.diagnostic('Compiled current displayed code as ' + label + '; same bytes reject former label ' + oldLabel + '. Runtime/database behavior was not tested.');
    });
  });
}
