#!/usr/bin/env python3
"""Portable, standard-library-only content contract tests.

Default: inspect staged records and candidate items.
--dist PATH: additionally inspect actual integrated final dist, archives and routes.
--baseline-dist PATH: verify exact before fields (use only before integration).
These are content/conservation tests, not an audio runtime or page-layout test.
"""
import argparse
import copy
import json
import math
import re
import sys
import unittest
from pathlib import Path
from urllib.parse import unquote
from html import unescape
from html.parser import HTMLParser
from html_blocks import TopLevelBlocks, digest

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--dist',type=Path)
parser.add_argument('--baseline-dist',type=Path)
args,remaining=parser.parse_known_args()

def read(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
BEFORE=read('before-items.json')
CANDIDATE=read('candidate-items.json')
RECORDS=read('records.json')['records']
BLOCKS=read('candidate-blocks.json')
MAP=read('source-block-destinations.json')
ARCHIVE=read('archive-proposal.json')
ENTRY_ID=CANDIDATE['entryId']
BODIES={i:v['a'] for i,v in CANDIDATE['items'].items()}
BY_BLOCK={x['blockId']:x for x in BLOCKS}

class Links(HTMLParser):
 def __init__(self,raw):
  super().__init__();self.hrefs=[];self.ids=[];self.feed(raw)
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if 'id' in d:self.ids.append(d['id'])
  if tag=='a':self.hrefs.append(d.get('href',''))

def find_entry(dist):
 data=json.loads((dist/BEFORE['sourceChapter']).read_text(encoding='utf-8'))
 return next(e for e in data['entries'] if e['id']==ENTRY_ID)

def rawtext(html): return unescape(re.sub('<[^>]*>', '', html))

def validate_semantics(bodies):
 checks={
  '1':[
   ('separate routes',['OCR','结构化','图像特征','文本']),
   ('OCR modularity and propagated errors',['分段','替换','错误会传到下游']),
   ('VLM route conditions',['复杂版式','图表','截图','预处理','成本','部署']),
   ('baseline not universal order',['基线','不是所有文档']),
   ('input output failure cost',['输入、输出和失败成本']),
   ('visual evidence structure',['原件','页码','区域坐标','表格行列结构','引用关系','时间轴']),
   ('three different alignments',['表示对齐','细粒度对齐','任务对齐','不会自动']),
   ('screenshot objective and uncertainty',['识字','解释故障','查找资料','操作界面','图标','状态关系','小字','裁剪放大','看不清']),
   ('screenshot authorization',['只是输入内容','不等于获得点击、发送或删除权限','当前界面状态','用户目标','动作授权']),
   ('extra visual pipeline',['图片预处理','空间定位','视觉 token 预算','视觉证据校验']),
   ('fusion term qualification',['先约定术语','论文分类未必一致']),
   ('early fusion caveats',['早融合','位置、长度和缺模态','成本','序列增大']),
   ('middle fusion caveats',['中融合','跨注意力','连接器','门控','编码器','对齐训练']),
   ('late fusion costs',['晚融合','分数、排名或结果','缺模态降级','细粒度图文关系','校准','任意置信度直接相加']),
   ('routing quality guardrail',['分类','关键帧筛选','所有原始视频帧','费用、排队和无关上下文','高价值或不确定','路由本身也要评估','不能因为便宜就漏掉关键证据']),
   ('system quality',['商品图检索','召回和向量存储','版本、权限、超时、可观测性和回退','不能用一个模型分数']),
   ('task taxonomy boundaries',['跨模态检索','视觉证据支持','图像或视频生成','结构与时序一致性','画面好看不等于物理上合理','检索相似度不等于能解释复杂图表']),
   ('VLM motor boundary',['VLM','不等于 VLA','不能证明输出可以直接驱动硬件']),
  ],
  '2':[
   ('modalities not scheduling',['轮次和播放时序','低延迟、流式输出','不能简单把语音等同于实时、文本等同于异步']),
   ('four diagnostic stages',['ASR→LLM','TTS','采集与分帧','四段诊断']),
   ('dependent streaming stages',['部分阶段重叠','后一步仍依赖前一步','不能把整轮说成完全并行']),
   ('native path observability',['未必暴露独立的 ASR/TTS 接口','不能','虚构','不保证所有任务都更快']),
   ('round cancellation',['轮次、片段与版本','已播放位置','取消旧轮生成','停止旧音频播放','丢弃过期结果','不等于已经清空客户端播放缓冲']),
   ('budgets background and guardrails',['首次可听响应、连续播放和打断停播','预算','后台继续','文本长任务','状态反馈不等于任务完成','权限检查、事实核验和失败降级']),
   ('actual timestamps',['用户停止说话','系统确认轮次结束','ASR 给出稳定文本','LLM 产出首个有效文本片段','TTS 返回首个可解码音频','客户端真正开始播放']),
   ('endpoint wait',['不能只从 ASR 请求发出后开始计时','轮次结束判断本身就可能等待']),
   ('hidden delays',['服务端首个音频字节不等于客户端开始播放','网络往返','解码','播放缓冲','RAG','工具','安全检查','等待、排队和执行时间']),
   ('critical path and quantiles',['关键路径','不能把各组件平均耗时相加','p95 更不能直接相加','完整请求样本','相同负载、输入长度与缓存条件']),
   ('four user metrics',['首次可听响应','后续音频断续','整轮完成','用户打断到旧音频停止','只看最终答案质量或某个模型耗时']),
   ('text-only replay insufficiency',['最终转写文本','查不到采集分帧、迟到片段、ASR 修订和轮次结束判断']),
   ('minimum event replay',['获准保留的最少录音与事件','相对时间','分片边界','partial/final 修订','打断和服务错误']),
   ('replay versus experiment',['替身固定外部响应','重新调用真实模型则是另一次集成实验','不能声称一定重现同一输出']),
   ('no real side effects',['无真实副作用的隔离环境','不能再次提交原会话里的预约、付款或消息']),
   ('failures contracts privacy',['ASR 不可用','模型超时','TTS 失败','旧轮结果迟到','说明状态','停止过期播放','合同降级','录音、转写和用户身份','授权、最小保留和删除策略','不能为了可复现无限保存'])
  ]}
 failures=[]
 for i,rows in checks.items():
  text=rawtext(bodies[i])
  for label,tokens in rows:
   missing=[s for s in tokens if s not in text]
   if missing:failures.append({'item':i,'condition':label,'missing':missing})
 if failures:raise AssertionError(json.dumps(failures,ensure_ascii=False))
 if re.search(r'ASR|TTS|语音对话的延迟|级联四段', bodies['1']):
  raise AssertionError('Voice implementation detail leaked back into visual answer')
 return sum(len(x) for x in checks.values())

class ContentContracts(unittest.TestCase):
 def test_01_owned_fields_only(self):
  self.assertEqual({(r['path'][1],r['path'][2]) for r in RECORDS},{(1,'q'),(1,'a'),(1,'lead'),(2,'a'),(2,'lead')})
  self.assertTrue(all(r['entryId']==ENTRY_ID for r in RECORDS))

 def test_02_exact_before_after_raw_hashes(self):
  for r in RECORDS:
   i=str(r['path'][1]);field=r['path'][2]
   self.assertEqual(r['before'],BEFORE['items'][i][field])
   self.assertEqual(r['after'],CANDIDATE['items'][i][field])
   self.assertEqual(digest(r['before']),r['beforeSha256'])
   self.assertEqual(digest(r['after']),r['afterSha256'])

 def test_03_patch_reconstructs_candidates(self):
  projected=copy.deepcopy(BEFORE['items'])
  for r in RECORDS:
   i=str(r['path'][1]);field=r['path'][2]
   self.assertEqual(projected[i][field],r['before'])
   projected[i][field]=r['after']
  self.assertEqual(projected,CANDIDATE['items'])

 def test_04_identity_and_other_fields_unchanged(self):
  self.assertEqual(set(CANDIDATE['items']),{'1','2'})
  for i in ['1','2']:
   for field in set(BEFORE['items'][i]) - {'q','a','lead'}:
    self.assertEqual(BEFORE['items'][i][field],CANDIDATE['items'][i][field])
  self.assertEqual(CANDIDATE['items']['2']['q'],BEFORE['items']['2']['q'])
  self.assertEqual(CANDIDATE['items']['1']['q'],BEFORE['items']['1']['q'].split('？')[0]+'？')

 def test_05_every_original_block_mapped_exactly_once(self):
  for i in ['1','2']:
   rows=[r for r in MAP['sourceBlocks'] if r['sourceStableReviewKey']==ENTRY_ID+'#'+i]
   self.assertEqual([r['sourceOrdinal'] for r in rows],list(range(len(rows))))
   self.assertEqual(''.join(r['sourceRawHtml'] for r in rows),BEFORE['items'][i]['a'])
   self.assertEqual(len(rows),len(TopLevelBlocks(BEFORE['items'][i]['a']).blocks))
   for r in rows:
    self.assertEqual(digest(r['sourceRawHtml']),r['sourceSha256'])
    self.assertTrue(r['destinations'])

 def test_06_all_destinations_exist_and_match(self):
  self.assertEqual(len(BY_BLOCK),len(BLOCKS))
  for r in MAP['sourceBlocks']:
   for d in r['destinations']:
    actual=BY_BLOCK[d['blockId']]
    self.assertEqual(actual['sha256'],d['sha256'])
    self.assertEqual(actual['stableReviewKey'],d['stableReviewKey'])
  for i in ['1','2']:
   arr=[b for b in BLOCKS if b['itemIndex']==int(i)]
   self.assertEqual(''.join(b['html'] for b in arr),BODIES[i])

 def test_07_candidates_are_balanced_complete_blocks(self):
  for i in ['1','2']:
   self.assertEqual(len(TopLevelBlocks(BODIES[i]).blocks),sum(b['itemIndex']==int(i) for b in BLOCKS))
   self.assertFalse(re.search(r'<pre\b|<code\b|```',BODIES[i]))

 def test_08_original_anchors_survive(self):
  for i in ['1','2']:
   self.assertTrue(set(Links(BEFORE['items'][i]['a']).ids)<=set(Links(BODIES[i]).ids))

 def test_09_variants_and_removed_title_preserved(self):
  for row in MAP['variants']:
   block=BY_BLOCK[row['destination']['blockId']]['html']
   self.assertIn(row['originalText'],block)
   self.assertEqual(digest(row['originalText']),row['originalSha256'])
  removed=MAP['fieldChanges'][0]['removedExactText']
  self.assertIn(removed,BY_BLOCK['voice-variants']['html'])
  self.assertNotIn('语音识别等 AI 服务',BODIES['1'])
  self.assertIn('语音识别等 AI 服务',BODIES['2'])

 def test_10_variant_summary_counts(self):
  for i in ['1','2']:
   block=next(b['html'] for b in BLOCKS if b['itemIndex']==int(i) and b['blockId'].endswith('-variants'))
   self.assertEqual(int(re.search(r'其他问法（(\d+)）',block).group(1)),len(re.findall(r'<li>',block)))

 def test_11_archive_exact_bytes_and_context(self):
  html=(ROOT/ARCHIVE['stagedPath']).read_text(encoding='utf-8')
  self.assertEqual(digest(html),ARCHIVE['archiveSha256'])
  original=''.join(b['html'] for b in ARCHIVE['originalBlocks'])
  self.assertIn('<section id="original-context">'+original+'</section>',html)
  self.assertEqual(digest(original),ARCHIVE['archiveOriginalBlocksSha256'])
  for b in ARCHIVE['originalBlocks']:
   self.assertEqual(digest(b['html']),b['sha256'])
  for span in ARCHIVE['exactControlSpans']:
   self.assertIn(span['text'],html)
   self.assertEqual(digest(span['text']),span['sha256'])
  self.assertIn(ARCHIVE['publicRelativePath'],BODIES['1'])

 def test_12_original_unique_information_semantics(self):
  self.assertEqual(validate_semantics(BODIES),34)

 def test_13_negative_fixture_missing_privacy_is_rejected(self):
  bodies=dict(BODIES);bodies['2']=bodies['2'].replace('授权、最小保留和删除策略','无限保留')
  with self.assertRaises(AssertionError):validate_semantics(bodies)

 def test_14_negative_fixture_voice_leak_is_rejected(self):
  bodies=dict(BODIES);bodies['1']+='<p>ASR→LLM→TTS</p>'
  with self.assertRaises(AssertionError):validate_semantics(bodies)

 def test_15_negative_fixture_lost_quantile_condition_is_rejected(self):
  bodies=dict(BODIES);bodies['2']=bodies['2'].replace('p95 更不能直接相加','p95 可以直接相加')
  with self.assertRaises(AssertionError):validate_semantics(bodies)

 def test_16_negative_fixture_lost_visual_authority_is_rejected(self):
  bodies=dict(BODIES);bodies['1']=bodies['1'].replace('不等于获得点击、发送或删除权限','即获得点击、发送或删除权限')
  with self.assertRaises(AssertionError):validate_semantics(bodies)

 def test_17_no_invented_project_or_measurements(self):
  for body in BODIES.values():
   self.assertFalse(re.search(r'我(?:们)?(?:在项目中|上线后|实测|压测得到)|提升了\d|下降了\d|降低了\d|\d+\s*ms',rawtext(body)))
   self.assertTrue(rawtext(body).startswith(('我会','最大的差别')))

 def test_18_primary_sources_present(self):
  sources=read('official-sources.json')['sources']
  self.assertEqual(len(sources),4)
  self.assertTrue(all(s['url'].startswith(('https://developers.openai.com/','https://arxiv.org/abs/')) for s in sources))
  self.assertTrue(all(s['limit'] for s in sources))

 def test_19_synthetic_overlap_is_not_sum(self):
  # Abstract event fixture, not a measured voice system: A=[0,6], B=[3,9].
  segments=[(0,6),(3,9)]
  critical_finish=max(e for _,e in segments)-min(s for s,_ in segments)
  summed_duration=sum(e-s for s,e in segments)
  self.assertEqual(critical_finish,9)
  self.assertEqual(summed_duration,12)
  self.assertNotEqual(critical_finish,summed_duration)

 def test_20_synthetic_percentiles_are_not_additive(self):
  # Complementary stage delays: every whole request sums to 10 arbitrary units.
  a=list(range(1,10))*10;b=[10-v for v in a]
  def p95(x):return sorted(x)[math.ceil(.95*len(x))-1]
  self.assertEqual(p95([x+y for x,y in zip(a,b)]),10)
  self.assertEqual(p95(a)+p95(b),18)

 def test_21_baseline_fields_if_requested(self):
  if not args.baseline_dist:self.skipTest('Baseline mode not requested')
  actual=find_entry(args.baseline_dist)
  for r in RECORDS:
   self.assertEqual(actual['items'][r['path'][1]][r['path'][2]],r['before'])

 def test_22_final_dist_fields_if_requested(self):
  if not args.dist:self.skipTest('Actual final-dist mode not requested')
  actual=find_entry(args.dist)
  for r in RECORDS:
   self.assertEqual(actual['items'][r['path'][1]][r['path'][2]],r['after'])
  for i in ['1','2']:
   for field in ['id','sub','mk','leadType']:
    self.assertEqual(actual['items'][int(i)].get(field),BEFORE['items'][i].get(field))
  self.assertGreaterEqual(len(actual['items']),BEFORE['entryItemCount'])
  validate_semantics({i:actual['items'][int(i)]['a'] for i in ['1','2']})

 def test_23_final_archive_if_requested(self):
  if not args.dist:self.skipTest('Actual final-dist mode not requested')
  raw=(ROOT/'sixth-archive-reconciliation.json').read_text(encoding='utf-8');self.assertEqual(digest(raw),'7c63fa6ee3fdd4391cd7d2cad859341aa447f10dd1b26b5cf9a408c4085f7c9c')
  proof=json.loads(raw);a=proof['approvedArchive'];self.assertEqual(a['distRelativePath'],ARCHIVE['publicRelativePath'])
  self.assertEqual(digest((ROOT/'archive-proposal.json').read_text(encoding='utf-8')),proof['oldArchiveProposalSha256'])
  self.assertEqual(digest((ROOT/'verifier-hashes.json').read_text(encoding='utf-8')),proof['oldVerifierHashesSha256'])
  before=(ROOT/a['distRelativePath']).read_text(encoding='utf-8');self.assertEqual(before,a['before']);self.assertEqual(digest(before),ARCHIVE['archiveSha256']);self.assertEqual(digest(before),a['beforeSha256'])
  at=a['insertionOffsetCodePoints'];self.assertEqual(digest(before[:at]),a['unchangedPrefixSha256']);self.assertEqual(digest(before[at:]),a['unchangedSuffixSha256'])
  self.assertEqual(digest(a['insertedHtml']),a['insertedSha256']);self.assertEqual(a['after'],before[:at]+a['insertedHtml']+before[at:]);self.assertEqual(digest(a['after']),a['afterSha256'])
  actual=(args.dist/ARCHIVE['publicRelativePath']).read_text(encoding='utf-8');self.assertEqual(actual,a['after']);self.assertEqual(digest(actual),a['afterSha256'])
  self.assertEqual(actual[:at],before[:at]);self.assertEqual(actual[at+len(a['insertedHtml']):],before[at:]);self.assertEqual(actual.count('id="model3-vla-original"'),1)
  record=proof['originalQuantizationRecord'];self.assertEqual(record['path'],['items',7,'a']);self.assertEqual(digest(record['before']),record['beforeSha256'])
  blocks=[m.group(0) for m in re.finditer(r'<(p|h[1-6]|li|th|td|summary)\b[^>]*>[\s\S]*?</\1>',record['before'])];self.assertEqual([x['index']for x in proof['sourceBlockMappings']],[23,24,68])
  for row in proof['sourceBlockMappings']:
   self.assertEqual(row['oldHtml'],blocks[row['index']]);self.assertEqual(digest(row['oldHtml']),row['oldSha256']);self.assertEqual(digest(row['newHtml']),row['newSha256']);self.assertIn(row['newHtml'],a['insertedHtml'])
   if row['mode']=='exact-original-html':self.assertEqual(row['newHtml'],row['oldHtml'])
   else:self.assertEqual(row['mode'],'li-to-explicit-original-question-paragraph');self.assertEqual(row['newHtml'],'<p>原问法：'+unescape(re.sub('<[^>]+>','',row['oldHtml']))+'</p>')

 def test_24_routes_and_archive_link_if_dist_requested(self):
  dist=args.dist or args.baseline_dist
  if not dist:self.skipTest('No dist selected for route resolution')
  entries={}
  for path in (dist/'data/chapters').glob('*.json'):
   entries.update({e['id']:e for e in json.loads(path.read_text(encoding='utf-8'))['entries']})
  for i in ['1','2']:
   for href in Links(BODIES[i]).hrefs:
    if href.startswith('#/e/'):
     parts=unquote(href[4:]).split('/')
     self.assertIn(parts[0],entries,href)
     if len(parts)>1:
      items=entries[parts[0]].get('items',[])
      self.assertTrue((parts[1].isdigit() and int(parts[1])<len(items)) or any(x.get('id')==parts[1] for x in items),href)
    else:
     self.assertEqual(href,ARCHIVE['publicRelativePath'])
     self.assertTrue(((args.dist or ROOT)/href).exists(),href)

if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(ContentContracts)
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 print(json.dumps({'mode':'final-dist' if args.dist else 'staged','testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'executed':result.testsRun-len(result.skipped),'actualDistVerified':str(args.dist) if args.dist else None,'baselineDistVerified':str(args.baseline_dist) if args.baseline_dist else None,'boundaries':'Content/identity/conservation/routes only. Not real audio/model benchmarking or browser/layout acceptance.'},ensure_ascii=False))
 sys.exit(not result.wasSuccessful())
