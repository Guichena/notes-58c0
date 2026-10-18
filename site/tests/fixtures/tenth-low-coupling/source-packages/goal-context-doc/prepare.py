import json,pathlib,hashlib,re
P=pathlib.Path(__file__).parent
root=P.parents[1]/'integration-site/dist/data/chapters'
for f in root.glob('*.json'):
 for e in json.loads(f.read_text())['entries']:
  if e['id']=='doc-18': entry=e;src=f
before=entry['html']; after=before; segments=[]
def replace(old,new,reason):
 global after
 assert after.count(old)==1,(old[:60],after.count(old))
 after=after.replace(old,new);segments.append({'before':old,'after':new,'reason':reason})
start=before.index('<h2 class="md-h md-h2">7. 好的 Plan 示例：GCCSC</h2>');end=before.index('<h2 class="md-h md-h2">8. 为什么需要 Replan</h2>')
new='''<h2 class="md-h md-h2">7. 把目标、步骤与验收串成一份计划</h2>
<p class="md-p">可以用 Goal、Context、Constraint、Step、Checkpoint（GCCSC）记住计划要素；它是组织回答的记忆框架，不是 ReAct 的标准协议。</p>
<p class="md-p">沿用前面的假设简历任务：面向 P6 岗位、目标薪资 30K，交付完整简历、项目亮点和面试话术；这些只是假设输入，不是用户现状或求职结果承诺。读取原始简历、求职目标、目标岗位、真实项目经历和已有面试案例，缺资料先收集。约束为不超过 3 页、适合投递；3 分钟运行限制、N 个项目与每项目 M 个亮点也只是待确认题设。</p>
<p class="md-p">执行顺序可以是收集信息、识别核心短板、选择表达策略、准备案例、整理项目亮点、生成简历与 PDF。关键验收点分别是目标确认、短板识别完成、表达策略确认、亮点可验证、最终简历满足约束；不是每一个小步骤都要单独落检查点。</p>
<p class="md-p">项目亮点必须来自真实贡献和可验证实验。已完成 Agent 项目才说明实际实现范围与验证结果；尚未完成的列为后续练习，拟议方案和未来计划单独说明。ReAct 的推理与行动交错本身不提供业务持久执行、授权或恰好一次保证。</p>
'''
replace(before[start:end],new,'Merge repeated Goal/Context/Constraint/checkpoint lists into one continuous worked example; retain every distinct input, placeholder, output and truthfulness condition.')
replace('选择包装策略','选择表达策略','Describe truthful presentation rather than packaging',) if after.count('选择包装策略')==1 else None
replace('Checkpoint 3：项目包装策略已确定。','Checkpoint 3：项目表达策略已确定。','Same checkpoint semantics with direct truthful wording')
start=after.index('<h2 class="md-h md-h2">计划与恢复的关系</h2>');old=after[start:]
new='''<h2 class="md-h md-h2">面试收束：计划和恢复怎样配合</h2><p class="md-p">先用目标、上下文、约束、步骤和检查点把任务说清，再根据新证据调整剩余路径。追问失败恢复时，重点说明为什么选当前步骤、阶段、局部或全局重规划，以及旧派发、可信产物、在途动作和外部效果怎样处理；不是重新生成一张步骤表就算恢复。</p>'''
replace(old,new,'Closing recap condensed; all detailed previous Plan/Replan and external effect preservation sections remain literal.')
P.joinpath('before.entry.json').write_text(json.dumps(entry,ensure_ascii=False,indent=2));P.joinpath('before.html').write_text(before);P.joinpath('after.html').write_text(after)
h=lambda x:hashlib.sha256(x.encode()).hexdigest()
P.joinpath('proposal.exactleaf.json').write_text(json.dumps({'candidateOnly':True,'status':'main-authored-await-independent-review','sourceFile':str(src),'records':[{'entryId':'doc-18','path':['html'],'before':before,'after':after,'beforeSha256':h(before),'afterSha256':h(after),'segments':segments}],'unchangedScope':'Every byte outside exact disjoint segments; original lead and all metadata unchanged','preservedCriticalSections':['12.1 monotonic prerequisite for bisection and TCC not general rollback','12.2 cause dimensions','12.3 evidence and actual successful-write/missing-checkpoint window','freeze old dispatch, reconcile inflight, preserve operationId and effects, cumulative budgets']},ensure_ascii=False,indent=2))
print({'segments':len(segments),'beforeChars':len(before),'afterChars':len(after),'afterSha':h(after)})
