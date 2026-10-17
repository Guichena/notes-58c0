import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read = async path => JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const manifest = await read('content/display-projection.json');
const fields = manifest.fields.filter(f=>f.honesty_review);
const html = id => fields.find(f=>f.entry_id===id && f.field==='html').new_full_field;
test('reviewed honesty projection has eight exact guarded fields',()=>{
 assert.equal(fields.length,8);
 assert.equal(manifest.honesty_revision.proposal_sha256,'721f443a882e6aef5cc1d53adb597fec0528570bdf0854a61a423ff19ffeba6c');
 for(const f of fields)assert.equal(createHash('sha256').update(f.new_full_field).digest('hex'),f.new_full_field_sha256);
});
test('study prose does not recommend fabricating project experience',()=>{
 const prohibited=['以假乱真','真实经历仅供参考','AI 直接捏造','可以吹得越厉害','真实经历或可解释包装','必须包含 Agent 项目'];
 for(const f of fields)for(const phrase of prohibited)assert.ok(!f.new_full_field.includes(phrase),f.entry_id+': '+phrase);
 assert.ok(html('doc-08').includes('本地构造并验证一个死锁复现实验'));
 assert.ok(html('doc-09').includes('以下是假设故障案例'));
 assert.ok(html('doc-06').includes('换成自己真实实现和验证过的内容'));
});
test('hypothetical EXPLAIN example retains its exact technical tokens and conditions',()=>{
 const text=html('doc-08');
 for(const token of ['type=ALL','Extra','Using filesort','(user_id, status, create_time)','type','ref/range'])assert.ok(text.includes('<code class="tok-inline">'+token+'</code>'));
 assert.ok(text.includes('扫描行数约 80 万'));
 assert.ok(text.includes('不代表自己已经验证过的项目成果'));
 assert.ok(text.includes('取决于查询条件、选择率与优化器决策'));
 assert.ok(text.includes('完成后用实际记录替换示例数字'));
});
