import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const fixtures=path.join(here,'fixtures/framework-adapter-cleanup');
const dist=path.resolve(process.env.SITE_DIST||path.join(here,'../dist'));
test('framework adapter: exact actual leaves, original conditions, real canonical prose and unchanged identities',()=>{
 const expected={"verify-final-dist.py":"c435bcf9751051642e964f44fed0a55a9850f5867c834394dd6204f4186b1a30","verify-negative-dist.py":"11c48a14f2d5c492921a270d1375a3904da70edbc5b2974b97fe5565f57099fe","check-before.py":"a4eb80934be46bdf59e329b02d2ce513b67b89fed65cf5aee7ef0f46b05e01e6","records.json":"031a90f0d575bd8533183a2557639d10a3291937216ac8c0c7ab374de0a21a8d","source-blocks.json":"e1adbd671c53632427ca0a4dc8036a3c5519b28250848abdcca991a679e137fa","source-sections.json":"9d202e73e9f3b3b37a5e8274e3c0c40ae944513aba55805552bdc0aafd87e455","source-variants.json":"ea770e35b38e9d626572377c104c08d3c2dc21f6cc5337fe0ee4dc2d74ab70e1","paragraph-destinations.json":"ed374b2505049bdd7aeae10f29157c0d7a4417aa97a372531539324a913a3966","variant-condition-map.json":"dc7194fe281e2e21c7f7d819697883405ccbadf6d5badcc5f341e5714274174f","evidence-witnesses.json":"58a8bb5679663ad02d925eaffa411ebf79bb059119c569dbe6f15ed745c7a13c","display-questions.json":"12b01277f644cfbe0ed1079542429ddb4696d82e2a64dff02e3dca97775c99fe","identity-baseline.json":"cd4be49d9ab9f3f9e4bc534de3cb469f8ba82d4e17855c263754f8723f32a93e","new-paragraphs.json":"b4586d95ffff09b81e3b6fc0e77b9e9bc210f6fad0b0833297066bb4c9b95a15"};
 for(const [name,hash] of Object.entries(expected))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),hash,'candidate fixture drift '+name);
 const r=spawnSync(process.env.PYTHON||'python3',[path.join(fixtures,'verify-final-dist.py'),'--dist',dist],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
 assert.equal(r.status,0,r.stdout+r.stderr);const v=JSON.parse(r.stdout);assert.equal(v.status,'PASS_ACTUAL_FINAL_DIST');assert.equal(v.dist,dist);assert.equal(v.changedLeaves,4);assert.equal(v.sourceBlocks,87);assert.equal(v.sourceQuestions,49);assert.equal(v.fineConditions,79);assert.equal(v.substantiveWitnesses,154);
});
