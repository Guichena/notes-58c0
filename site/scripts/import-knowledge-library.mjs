// One-shot importer for the interview knowledge library.
// The site build reads only the checked-in copies, never the source drive.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {KNOWLEDGE_DOCS} from './knowledge-library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = 'G:\\我的云端硬盘\\学习资料库';
const examSource = 'C:\\Users\\guichen\\Documents\\deepseek-harness\\default-workspace\\后端+Agent 面试考点分布与高频知识点.md';
const contentDir = path.join(root, 'content', 'knowledge-library');
await mkdir(contentDir, {recursive: true});

let images = 0;
const missing = [];
for (const doc of KNOWLEDGE_DOCS) {
  const sourcePath = path.join(sourceRoot, ...doc.source.split('/'));
  const markdown = await readFile(sourcePath, 'utf8');
  await writeFile(path.join(contentDir, doc.id + '.md'), markdown.replace(/\r\n?/g, '\n'));
  const refs = [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^https?:\/\//i.test(ref)) continue;
    const from = path.resolve(path.dirname(sourcePath), ref);
    const relative = path.relative(path.dirname(sourcePath), from);
    if (relative.startsWith('..')) throw new Error('Image escapes document directory: ' + ref);
    const to = path.join(root, 'public', 'assets', 'knowledge', doc.id, relative);
    await mkdir(path.dirname(to), {recursive: true});
    try { await copyFile(from, to); images += 1; }
    catch (error) { missing.push({doc: doc.id, ref, error: error.message}); }
  }
}
await writeFile(path.join(contentDir, 'exam-map.md'), (await readFile(examSource, 'utf8')).replace(/\r\n?/g, '\n'));
if (missing.length) throw new Error('Missing images: ' + JSON.stringify(missing));
console.log(`Imported ${KNOWLEDGE_DOCS.length} knowledge documents, ${images} images and the exam map.`);
