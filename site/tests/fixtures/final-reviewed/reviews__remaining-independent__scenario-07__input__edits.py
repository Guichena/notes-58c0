notes={
'own-distributed-ch09':'Read all seven answers, leads, TopK algorithm supplement, income supplement and variants. Retain 100 groups, 100k QPS/hour, 8.64GB, local-top10 counterexample, 50/51 boundary, five-minute top100 variant, 1.4bn/January1/8am and all arithmetic. Correct conflicting TopK complexity and absent-code claims; distinguish group count from row count and CDC cursor from event-time watermark.',
'own-distributed-ch10':'Read all seven complete answers and cloud-drive bandwidth supplement. Preserve camera 2Mbps/2Tbps/21.6PB, 1% instantaneous versus daily average, 30 days/three replicas, SFU topology and all failure/permission contracts. Component/source scope retained; no throughput or availability guarantees added.',
'own-distributed-guide':'Current catalog wording retained, including newer learning route links and all chapter anchors. Version numbers are teaching premises, not verified deployed dependencies. No code or source archive modified.',
'own-mq-contracts':'All five full answers and supplements reviewed. Preserve cancellation 24 permutations/100 calls, account 30/100/10 examples, telemetry 101–110 with hole103, all transfer UNKNOWN branches. Local-model historical test claims relabeled as source-described expectations; no new executable listing.',
'own-mq-cross-topic-reference':'Retain complete 1GB, 500k products, ten-million export, four-worker deadlock and tens-of-GB dedup restrictions. Alternatives and crash recovery already detailed; no Redis/Kafka workaround introduced.',
'own-mq-noteweave':'Pinned source evidence supports upload transaction, Outbox publish/complete window, and narrowly scoped ResearchAgent canonical completion. Preserve concrete parameters as source-reported where actual pinned config was not available. No deployment, author achievement or capacity inference.',
'own-mq-operations':'Read quota, MySQL/Kafka/ES and ad-stream join completely, including every supplemental question. Retain 100/10000 and backlog arithmetic, servingId versus eventId, 8.19 bulk semantics. Add ES deletion tombstone retention caveat and source-reference boundary.',
'own-mq-reliability':'Read all full answers including stage/lease, transaction and Agent Runtime supplements. Keep current catalog Runtime link. Conditional external-effect contracts are sound; add no universal guarantee. Authored lead retained even where independent overview is not an answer prefix; compiled renderer supports this.',
'own-mq-source-guide':'Read preflight and current catalog additions; preserve current topic routes, original chapter anchor identities and all version premises. Clarify existing pinned source inspection versus remaining configuration/runtime gaps.',
'own-mq-tasks':'Read all three long answers and supplements. Retain four-stage obligations,128MiB/134217728 bytes, task IDs/generations,500000 row boundaries, concurrent editing, five repeated commands, budget and cancellation semantics. Rephrase absent-code/local-run claims; maintain all specific source experiment conditions.',
'own-practice-approval-rule-selection':'Complete lead/body reviewed; preserve Chinese alias requirement, alternatives, approval transitions and deadline mechanics. Add frozen rule version per approval revision and publication-time authority check.',
'own-practice-authoritative-deadlines':'Full original retained; replace repeated short lead with direct conclusion and expand server-time estimation, save/submit races, inclusive cutoff policy, offline and refresh recovery.'}
x=stages['own-distributed-ch09']['items']
rep(x[1],'读取这 100 条已授权数据','读取这 100 个群的已授权数据（群数不等于事件行数）')
rep(x[1],'100条数据的处理通常先评估单进程方案','100个群的MVP通常先评估单进程方案，仍需实际统计每群事件量')
rep(x[1],'保证watermark和失败重跑幂等','保存增量读取游标及同时间戳的稳定次序，并使失败重跑幂等；这里的扫描游标不是事件时间watermark')
rep(x[2],'读取前K个O(K)','在当前TreeSet教学模型中，无过期清理时读取前K个为O(1+log(U+1)+min(K,U))')
rep(x[2],'完整Java教学实现与边界','精确窗口模型与实现边界')
rep(x[2],'以下实现精确有序窗口和全局合并反例/按IP分区的验证','对应手写源码用于检验精确有序窗口和全局合并反例/按IP分区条件；本页解释合同')
rep(x[2],'完整 Java 与参考对拍','参考对拍应检验什么')
rep(x[2],'该类对倒退时间明确拒绝','该模型要求对倒退时间明确拒绝')
rep(x[2],'这份代码用来明确精确语义','对应手写模型用来明确精确语义')
rep(x[5],'可执行聚合核心、复杂度与生产边界','聚合模型的状态、复杂度与生产边界')
rep(x[5],'完整 Java 代码 IncomeAccumulator.java','IncomeAccumulator.java 对应模型的验证范围')
rep(x[5],'Java聚合模型包含10000条合成事件测试','原资料描述Java聚合模型的10000条合成事件测试；本页未附完整程序，也未执行该测试')
# Keep every numerical case and mechanism while removing implications that code exists on this theory page.
repls=[('编译和运行：','独立源码的运行预期（本页不含完整程序）：'),('正常结束会打印 PASS:','原资料给出的预期摘要为 PASS:'),('完整 Java 代码 CouponCancellation.java','CouponCancellation.java 模型的输入与不变量'),('可执行模型与测试','状态模型与待验证场景'),('完整Java实现','对应源码的实现边界'),('实测30个不同扣款争100余额','原资料描述的测试场景是30个不同扣款争100余额'),('AccountLedger实测支持本地账务事务','原资料的AccountLedger模型面向本地账务事务；本轮未执行复验'),('实际第4.18节测试包含','原资料第4.18节列出的测试包含'),('可运行模型的保证','独立模型的合同与限制'),('后文完整TaskOrchestrationLab','配套独立源码TaskOrchestrationLab'),('第 11 章提供 Java 可运行实现。','第11章及独立源码说明Java模型；本页不包含完整程序，运行前须核对模块和依赖。')]
for eid in ['own-mq-contracts','own-mq-reliability','own-mq-tasks']:
 for it in stages[eid]['items']:
  for a,b in repls:it['a']=it['a'].replace(a,b)
x=stages['own-mq-noteweave']
rep(x,'NoteWeave 的 Java 控制面用数据库保存任务和状态','在固定提交的已核对上传、任务投递代码路径中，NoteWeave 的 Java 控制面用数据库保存任务和状态','html')
rep(x,'Compose 配置 MySQL 8.4，Kafka 镜像用 digest 固定','原资料报告 Compose 配置 MySQL 8.4、Kafka 镜像用 digest 固定；本轮保留这些来源参数，但未取得已脱敏的对应固定配置独立核对','html')
rep(x,'这份项目代码里的普通 Task Outbox 参数可以按用途记','下列普通 Task Outbox 数字按原资料记录，已检查的发布/完成源码支持token与重投机制，但未独立核全这些默认配置：','html')
rep(x,'代码明确配置了生产确认和消费错误处理','原资料报告下列生产确认和消费错误处理配置；本轮未独立核全该Kafka配置类','html')
rep(x,'研究任务的处理权沿三步检查','研究任务的领取、心跳及ResearchAgent canonical completion路径需分别检查；本轮已核对完成端的权威校验，不能泛化到所有Worker回调。原资料沿三步描述','html')
rep(x,'Q44–Q47 按固定 NoteWeave 提交解释真实字段、默认开关和失败分支','Q44–Q47 按固定 NoteWeave 提交组织字段、开关和失败分支；已核对源码与仅由原资料报告的配置须按下文边界区分','html')
add(x,'源码证据与部署证据分开',['已保存的固定提交源码支持：上传完成路径中关系库状态写入与外部存储复制不共享原子性；DurableOutboxDispatcher先领取、再发布、最后按token完成，发布与确认落库之间可重投；ResearchAgentCompletionCommitter在其canonical完成路径校验worker、epoch、fencing token和资源版本。','这些静态事实不证明线上配置、实际运行次数或个人负责范围。普通Outbox、Artifact回调、ResearchAgent完成是不同入口；未逐项核对的1秒/50条、10秒、1分钟、5次/60秒、20条/70分钟及单broker/三分区/单副本，继续作为原资料参数保留，不当作本轮独立实测。'],key='html')
x=stages['own-mq-source-guide'];rep(x,'未独立检查那个提交或实际部署','已有固定提交的部分源码静态核对，但并非全部配置与实际部署核验','html')
x=stages['own-mq-operations']['items'][1]
add(x,'删除与重建的晚到窗口',['Elasticsearch删除后的版本墓碑不会默认永久保留。若晚到旧写超过目标端删除版本保留窗口，仅使用external version可能仍复活数据；应保留应用删除墓碑、写入带deleted状态的版本文档，或在同一受控写路径查询权威版本并拒绝复活。索引换代后也要保留这项规则。','原资料引用的数据库与检索手册提供进一步阅读线索，不代表本页已包含Q60完整JDBC代码或已验证链接中的所有实现；这里的交付是bulk逐项处理、版本门控和重建合同。'])
x=stages['own-practice-approval-rule-selection']['items'][0]
add(x,'规则更新怎样不改变旧审批含义',['每次提交冻结适用规则版本与事实快照；规则上线后，进行中的审批继续旧版还是经明确流程迁移，需由业务规定。不能在最后一步悄悄换成最新规则，让同一审批前后用两套标准。','审批通过与真正发款、下单或授权不是同一提交点。执行前再次校验批准对象、参数摘要、版本和当前权限；参数或对象已变则重新审批。规则计算失败进入拒绝或待人工，重试不得制造第二次外部效果。'])
x=stages['own-practice-authoritative-deadlines']['items'][0]
old=x['lead'];x['lead']='<p class="md-p sx-ess"><span class="sx-tag">本质</span>服务端保存每次考试的权威截止时间，浏览器只显示剩余量；刷新、休眠和断网都不能重置考试期限。</p>';x['a']=x['a'].replace(old,x['lead'],1)
add(x,'显示时间与裁决时间分开',['开始考试用稳定attemptId，在事务中固定startedAt、deadlineAt和规则版本；重复开始请求返回同一场次，刷新重新读取，不再发完整时长。是否允许暂停、补时、重考及截止瞬间能否提交，都应有明确规则与审计，不能靠客户端自己加秒。','响应可带serverNow、deadlineAt和场次版本。前端以收到时的剩余量配合单调计时更新，网络往返导致的误差要承认；恢复可见、重连和长时间运行后重新校时。界面归零停止普通答题交互，但最终裁决仍在服务端，不能采信客户端时间戳证明按时。','保存草稿和最终交卷分别有操作ID、答案版本与状态。交卷事务校验身份、场次、截止规则和未提交状态，冻结答案并产生结果；超时后先查询同操作结果，不能新建一份卷。自动到期交卷与用户交卷竞争同一状态，避免两次评分。','离线草稿只改善体验，必须说明截止后补传是否接受；若允许宽限，宽限是服务端规则。测试刷新、多标签页并发、浏览器休眠、系统时钟回拨、断网到期、提交成功回包丢及管理员补时版本变化。'])
x=stages['own-mq-reliability']
for a,b in [('下面两个纯 Java 模型','配套源码中的两个纯 Java 模型'),('对应 MySQL 表结构如下，账号初始余额仅用于练习。','对应MySQL表结构在独立源码归档中；本页说明业务、inbox及outbox应同事务，账号初始余额仅用于练习。'),('下列命令仅用于上述全新的本机隔离实验。','独立源码归档中的命令仅用于上述全新的本机隔离实验。'),('Rabbit 的 prepare-deps 与 run-tests 脚本在本节全文','Rabbit的prepare-deps与run-tests脚本保存在独立源码归档'),('orchestration 的完整运行脚本在 Q31','orchestration的完整运行脚本在独立模块中，Q31说明运行前提'),('正常结束会打印 PASS: 7','原资料给出的正常结束预期为 PASS: 7')]:rep(x,a,b,'readingNotesHtml')
notes['own-mq-reliability']+=' Read full readingNotesHtml: cleanup/self-suppression, Rabbit deadlines20/12/30/2s,16000-byte/32KiB envelope,83-check and7-scenario models,Mock/real-client isolation. Correct absent table/script claims; retain all limits and source numbers.'
notes['own-mq-tasks']+=' Read complete Go/JS readingNotesHtml: Go1.23 expiry gap, mapLimit thrown falsy errors, dependency graph preallocation, LatestResult/Worker cancellation, macro/microtask distinction and unbounded VersionedUnban scan.'
