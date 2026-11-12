# 提示词与上下文工程

> **模块**：02_提示词与上下文工程/02_提示词与上下文工程.md  
> **构成**：2 个知识点合为一篇，按顺序编号  
> **规模**：约 839 行  |  **生成**：2026-11-12

## 目录

1. Prompt-Engineering
2. Context-Engineering

---

## 1. Prompt-Engineering

### 一、面试官在考什么

Prompt Engineering 是最容易被低估的一章。很多人觉得它“太浅”，结果一面试就暴露出明显问题：只会写一些自然语言描述，不会做任务建模，不会约束输出，不会排查失败原因，也分不清 prompt、context、tool schema 和 workflow 的边界。

**第一，面试官会看你是不是把 prompt 理解成“和模型聊天的话术”**。这是一个常见误区。真正的 prompt engineering，更像是给概率模型编写运行时程序：你要明确输入、任务目标、约束、输出结构、可用资源、失败边界和评价标准。只是这个程序是用自然语言、示例和 schema 写出来的。

**第二，面试官会看你是否知道 prompt 的影响范围**。一个好的 prompt 不只是让答案“更像人说的”，更重要的是：

- 减少歧义；
- 提高任务完成率；
- 提高格式稳定性；
- 提高工具调用准确率；
- 降低幻觉与越权行为；
- 降低后续解析和回滚成本。  
如果你只从“文案更顺滑”去理解 prompt，那还是停留在使用者视角。

**第三，Prompt Engineering 这章常被用来区分“会试”和“会做”**。会试的人在 playground 里反复改文案；会做的人会先定义验收标准、先做失败分类、先区分不同任务阶段，再去迭代 prompt。真正线上系统里，prompt 改动本质上是一种产品逻辑改动，要能评估、回滚、对比，不是灵机一动的艺术创作。

**第四，到 2025–2026 年，行业对 prompt 的理解也在变化**。OpenAI 的新一代模型提示指导、Anthropic 的 prompt engineering 文档、以及 context engineering/harness engineering 的兴起，都在说明：prompt 仍然重要，但它已经不再只是“写一句更优雅的话”，而是模型接口设计的一部分。

你可以在面试的时候这样讲：

> 💡 “我们把 prompt 当成应用逻辑的一部分管理。首先按任务类型拆成抽取、问答、工具执行三套模板；然后把规则、示例、输入和输出区分成独立区块；对证据敏感任务显式要求‘无证据返回 cannot_answer’，对结构化任务则强制 JSON schema。上线后不是凭感觉改 prompt，而是根据样本评测看格式合法率、幻觉率和任务完成率，再做小步迭代和版本回滚。”

### 二、什么是 Prompt Engineering

一个更工程化的定义是：

**Prompt engineering 是围绕模型输入进行设计、约束、分层、示例化和迭代的过程，其目标是在给定模型与上下文预算下，稳定地实现特定任务结果。**

这一定义有三个重点。

第一，它强调“围绕模型输入”，说明 prompt 不只是用户输入，还可能包含 system 指令、developer 规则、few-shot 示例、输出 schema、工具说明、检索证据等。

第二，它强调“稳定实现”，说明 prompt 的目标不是偶尔跑出一个好答案，而是在真实流量里稳定、可复现、可评估地完成任务。

第三，它强调“给定模型与上下文预算”，说明 prompt 不能脱离模型家族、token 成本、上下文长度、结构化输出能力、工具协议单独讨论。一个在大模型上可行的 prompt，未必适合 mini/nano 模型；一个在短上下文下有效的 prompt，未必适合 Agent 多轮链路。

### 三、好的 prompt 不是长，而是清楚

![](01_Prompt-Engineering_images/Prompt Engineering/BnitbdR7moErbhxdyDoc3tHEnCd.svg)

一个强 prompt 通常至少包含六类信息。

#### 1. 任务目标

模型到底要做什么。  
是总结、抽取、分类、改写、SQL 生成、规划任务、写代码，还是从证据中回答问题？  
目标必须可操作，不能只是“帮我处理一下”。

差的写法：  
“请分析下面内容。”  
好的写法：  
“请从下面病历文本中抽取患者姓名、主诉、诊断、用药，并输出为 JSON。”

#### 2. 输入边界

模型应该把哪部分内容当输入，哪部分当规则，哪部分是例子，哪部分是背景。  
分隔符、标题、小节标签、XML/JSON 包裹、Markdown heading 等都属于输入边界设计。很多模型失败，不是不会做，而是没分清“正文”和“指令”。

#### 3. 约束条件

包括：

- 不要输出什么；
- 不允许编造什么；
- 遇到信息不足怎么办；
- 是否允许调用工具；
- 是否必须严格按 schema 输出；
- 是否要先提取证据再回答。

约束越明确，模型越不容易自由发挥到错误方向。

#### 4. 输出格式

这是最常被忽略，却最容易直接提升工程可用性的部分。  
你要告诉模型输出是：

- 一段自然语言；
- Markdown 列表；
- 表格；
- JSON；
- 函数参数；
- 带字段的多段结构。

没有格式约束，后续解析和自动化都很难稳定。

#### 5. 示例与反例

few-shot 示例不是“给模型看几个漂亮答案”，而是在告诉模型：

- 任务分布长什么样；
- 边界情况怎么处理；
- 输出风格应该对齐什么模板；
- 哪些答案算错。

尤其在小模型、抽取任务、分类任务、结构化输出任务里，示例常常比空泛指令更有用。

#### 6. 自检与停止条件

在复杂任务里，你可以让模型在输出前做一轮检查，例如：

- 是否覆盖所有必填字段；
- 是否所有结论都有证据；
- 是否工具结果已回填；
- 是否最终输出是合法 JSON。

这类“轻量自检”在很多任务里比单纯写“请仔细思考”更有效。

### 四、Prompt 的常见模式：面试最爱问这些

#### 1. Zero-shot

不给示例，只给任务说明。适合规则清楚、分布简单、模型本身能力足够强的任务。  
面试里如果问 zero-shot 为什么越来越强，你可以回答：模型规模提升和 instruction tuning 让它在很多常见任务上不再严重依赖 few-shot。

#### 2. Few-shot

给少量输入输出示例，帮助模型理解任务模式。  
它尤其适合：

- label space 容易混淆的分类；
- 抽取字段边界不清的任务；
- 特定写作风格；
- 复杂 schema 生成；
- 小模型或成本敏感模型。

Few-shot 的关键不是越多越好，而是示例要覆盖真实边界。

#### 3. Chain-of-thought / 分步提示

传统做法是显式让模型“逐步思考”。它在数学、逻辑、多步决策中可能有帮助，但 2025–2026 年的一个明显趋势是：对很多新一代 reasoning 模型，不必事无巨细规定中间步骤。更好的做法往往是明确任务、约束、验收标准，把内部推理留给模型。  
所以面试里不要把 “let’s think step by step” 当成银弹，要强调：是否显式展示步骤，要看模型家族、任务类型、安全要求和成本。

#### 4. ReAct / 工具调用提示

当模型需要“先思考、再决定是否调用工具、再根据工具结果继续”时，prompt 需要明确：

- 何时调用工具；
- 工具的用途和边界；
- 工具失败怎么办；
- 返回结果后怎么整合；
- 最终给用户什么格式。  
这类 prompt 已经不是“问答文案”，而是执行逻辑说明。

#### 5. Critique-Revise / Self-check

让模型先给草稿，再做自检和修订。  
它适合：

- 长文生成；
- 复杂格式输出；
- 有多个验收维度的任务；
- 需要降低明显遗漏的场景。  
不过注意，这种模式会增加 token 成本和延迟，不适合所有任务。

### 五、Prompt Engineering 的核心原则：校招回答要讲得像工程

#### 原则 1：把目标写成可验收的任务

“写得更专业一点”“帮我优化一下”这种描述不够可操作。  
更好的方式是把目标写成：

- 目标对象；
- 成功标准；
- 不允许事项；
- 输出格式。

#### 原则 2：减少隐含假设

模型擅长补全，但不代表你的隐含假设都会被正确补全。  
如果读者、语气、长度、字段、格式、失败边界都不说，模型只能猜。  
Prompt 工程的本质之一，就是把你原本放在脑子里的假设尽量显式写出来。

#### 原则 3：分离规则、数据和示例

强烈建议把 prompt 中不同性质的信息分块写：

- 规则区；
- 输入数据区；
- 示例区；
- 输出区；  
这样不仅效果更稳，也更容易维护和测试。

#### 原则 4：把“不知道怎么办”也写进去

这是降低幻觉和错误执行的关键。  
你应该明确写：

- 若证据不足，返回 cannot_answer；
- 若字段缺失，返回 null 而不是编造；
- 若工具失败，输出 error_reason；
- 若请求越权，拒绝并说明原因。

好的 prompt 不是只定义成功路径，也定义失败路径。

#### 原则 5：Prompt 是要测的，不是要信的

真正做过项目的人都知道，prompt 看起来很合理，不代表线上就稳定。  
你需要用代表性样本去测：

- 任务成功率；
- 格式合法率；
- 幻觉率；
- 工具调用准确率；
- 平均 token 和延迟；
- 对边界输入的鲁棒性。  
所以 prompt engineering 本质上是 eval-driven iteration。

### 六、2025–2026 的新变化：Prompt 还重要，但它不再是全部

#### 1. OpenAI：更强调模型家族差异与提示模式迁移

OpenAI 的 reasoning best practices 和 GPT-5.4 prompt guidance 一再强调：不同模型家族行为差异明显。reasoning model 适合更明确目标与验收标准，而不是过细控制每一步；小模型则往往更需要显式约束与更具体提示。  
这意味着“一个万能 prompt 走天下”的时代已经过去，prompt 设计必须与模型选型联动。

#### 2. Anthropic：从 prompt engineering 走向 context engineering / harness

Anthropic 在 2025 年后连续发布 prompt engineering、effective context engineering、effective harnesses for long-running agents、advanced tool use 等文章，明显在传递一个信号：  
单条 prompt 仍重要，但真正决定 Agent 表现的，是上下文怎么组织、工具怎么设计、长期任务怎么压缩状态。  
所以今天谈 prompt，不能孤立谈“这句话怎么写”，而要连同上下文、工具和任务循环一起看。

#### 3. Gemini：参数与提示经验开始出现家族差异

Gemini 3 文档多次强调 temperature 保持 1.0 是推荐设置，低温不一定更稳。这是一个很好的提醒：prompt 和参数经验都要看模型家族，不能机械套用旧经验。  
对于多模态与结构化任务，Gemini 还把 structured output、function calling、files、long context 放在一个统一开发体系里，说明 prompt 早已不是孤立文本，而是 API 配置与上下文资产的一部分。

### 七、几个非常实用的 prompt 模板思路

#### 1. 抽取型模板

适合信息抽取、简历解析、票据解析、工单解析。

关键要素：

- 字段列表；
- 字段含义；
- 缺失时输出 null；
- 不允许编造；
- 输出 JSON Schema。

这类任务通常温度更低、格式约束更强。

#### 2. 证据问答模板

适合 RAG、文档问答、知识库问答。

关键要素：

- 只能依据给定证据回答；
- 先定位证据，再形成结论；
- 若证据不足明确返回无法回答；
- 最终附 evidence_ids / source list。

这类模板对减少幻觉特别有效。

#### 3. 工具调用模板

适合 Agent、函数调用、自动化工作流。

关键要素：

- 工具说明；
- 调用时机；
- 输入参数约束；
- 工具失败处理；
- 禁止在未调用工具时假装已执行。

这类模板对于降低“虚报已完成”非常关键。

#### 4. 评审/打分模板

适合 LLM-as-a-Judge、简历评分、内容审核。

关键要素：

- 评分维度；
- 评分等级定义；
- 先列观察，再给分；
- 输出 JSON 或表格；
- 禁止越过给定标准自由发挥。

评分任务最怕标准漂移，所以 prompt 里必须把 rubric 写清楚。

### 八、高频面试题与答题要点

#### 问题 1：Prompt Engineering 到底是什么？

它不是“和模型聊天的技巧”，而是围绕模型输入进行任务定义、约束、示例化和迭代的工程过程。

#### 问题 2：好的 prompt 最重要的部分是什么？

最重要的是明确任务目标、约束边界和输出格式，而不是把 prompt 写得特别长或特别像自然对话。

#### 问题 3：Few-shot 一定比 zero-shot 好吗？

不一定。强模型在常规任务上 zero-shot 已经很好；few-shot 更适合边界复杂、标签容易混淆、输出格式特殊、小模型场景。

#### 问题 4：为什么 prompt 要分块写？

因为规则、数据、示例、输出区分清楚后，模型更容易正确解释输入，你也更容易维护和调试。

#### 问题 5：如何降低 prompt 导致的幻觉？

显式写明证据边界、缺证据处理方式、字段缺失输出规则，并尽量提供结构化证据和输出 schema。

#### 问题 6：为什么不能只靠 prompt 解决一切？

因为模型能力、上下文质量、工具设计、缓存预算、评测闭环同样重要。prompt 是大杠杆，但不是唯一杠杆。

#### 问题 7：reasoning model 的 prompt 和普通模型有什么不同？

复杂 reasoning model 往往更适合明确目标和验收标准，而不是过细 micromanage；小模型则更需要显式步骤和例子。

#### 问题 8：prompt 改动为什么要配合评测？

因为它本质上会改变模型行为，需要用数据看成功率、鲁棒性、格式合法率和成本是否真的变好。

#### 问题 9：Prompt Engineering 和 Context Engineering 的区别是什么？

前者更偏单次提示设计与任务表达，后者更偏整个运行时上下文的选择、压缩、排序和生命周期管理。

#### 问题 10：项目里 prompt 一般怎么迭代？

先定义数据集与指标，分析失败类型，再定向修改任务描述、约束、示例或结构化输出要求，而不是盲改措辞。

### 九、常见误区

第一个误区，是以为 prompt 越长越好。实际上很多长 prompt 只是把歧义放大了。

第二个误区，是只会改措辞，不会改任务结构。真正有效的优化往往是重新定义目标、加格式约束、补 few-shot、改失败边界。

第三个误区，是把 prompt 结果不好直接归咎于模型太弱。很多时候是任务没写清、上下文没分块、输出没约束。

第四个误区，是把 prompt 视为一次性工作。生产上 prompt 必须版本化、评测化、可回滚。

### 十、我的一些观点

**Prompt engineering 的核心不是“写一句更聪明的话”，而是把任务、约束、证据和输出结构清楚地编排成模型能稳定执行的输入。**  
**Prompt 是要靠评测驱动迭代的产品逻辑，不应该是黑箱。**

### 资料来源与延伸阅读

#### 官方文档

1. OpenAI Prompt Engineering  
[https://developers.openai.com/api/docs/guides/prompt-engineering/](https://developers.openai.com/api/docs/guides/prompt-engineering/)
2. OpenAI Prompt Guidance for GPT-5.4  
[https://developers.openai.com/api/docs/guides/prompt-guidance/](https://developers.openai.com/api/docs/guides/prompt-guidance/)
3. OpenAI Best Practices for Prompt Engineering  
[https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api)
4. OpenAI Reasoning Best Practices  
[https://developers.openai.com/api/docs/guides/reasoning-best-practices/](https://developers.openai.com/api/docs/guides/reasoning-best-practices/)
5. Anthropic Prompt Engineering Overview  
[https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
6. Gemini Prompting Strategies  
[https://ai.google.dev/gemini-api/docs/prompting-strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
7. Gemini Text Generation / Gemini 3 Guide  
[https://ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)  
[https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)

#### 论文与补充

1. Brown et al., *Language Models are Few-Shot Learners*  
[https://arxiv.org/abs/2005.14165](https://arxiv.org/abs/2005.14165)
2. OpenAI Cookbook: GPT-5 Prompting Guide  
[https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide/](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide/)

### 补充 · 提示词工程（B 套）

> 来源：购买资料 B（原文第 997–1083 行）

#### 1 提示词工程

说实话，提示词工程不管是任何培训，都会作为一个很大的重点和知识模块去讲。谷歌甚至也是专门推出了8小时的提示词工程，但是在实际面试中，真的几乎没有出现，甚至是我总结的这些简单介绍提示词工程最基本的入门八股，都完全没有被考到！

并且提示词工程其实也不难，我的建议是，你好好地把下面这个视频看完，这个视频总结了google 8小时 提示词工程的核心要点，把这个视频消化，并且总结成笔记，运用到实战中，就可以了。不用花过多时间在提示词工程上。

写于2026-05-18: Prompt工程其实2026年已经很不火了，面试问的也不多，也都被Harness，Skill这些最新技术热度盖过了。面试问的少，不建议花太多时间在上面。不过从实用性的角度，因为我们使用AI，每次都需要写提示词嘛，还是看一下，看看这视频就大概就理解了。

https://www.youtube.com/watch?v=p09yRj47kNM

##### 1.1 简单介绍提示词工程。

（参考谷歌提示词工程课程）

提示词工程是指**设计和优化输入给llm的提示词，**以便获得更准确、有用或符合预期的输出结果的过程。

设计提示词有五大具体原则：**任务， 上下文， 参考示例， 评估标准，迭代**.

具体来讲：

**任务：**指我们要清晰地告诉LLM我们的任务，可以通过让llm角色扮演和规定输出格式的方法提高效果。

**上下文信息：**我们要提供足够的背景信息，让AI更好的理解，比如提供项目背景，已知数据，限制条件等。

**参考示例：**可以给出一些标准的输入输出的例子来供模型参考。

**评估：**每次拿到输出，判断结果是否符合预期。

**迭代：**如果不满足要求，我们需要反复进行prompt的优化和迭代。

 

##### 1.2 提示词工程技巧

提示词技巧可以分为**单次**和**多阶段**技巧来讲。

**单次技巧**：

1.重新检查提示词框架是否合理，比如是否包含了明确的任务，上下文信息，参考等。

2.将提示词拆分成更短的句子。避免使用冗长复杂的句子，拆分成更短的，有条理的句子。

3.尝试用不同的措辞，或者换成类比任务。

4.引入一些限制条件。 

**多次技巧**：

1.Prompt Chaining: 将多个提示词串联起来，每一步的输出作为下一步的输入，从而构建一个多阶段的任务流程。

2.Chain of thought prompting : 引导模型逐步思考，通过在提示中加入推理过程，让模型在回答问题时展示中间推理步骤，而不是直接给出答案。

3.Tree of thought prompting : 鼓励模型探索多个可能的路径或者思路，像树状结构一样展开，然后选择最优路径。

 

##### 1.3 面试真题

写于2026年8月，在我的经验看来，提示词工程几乎不会单独被拿出来考，比如问你COT是什么？我分析了这么多面试真题，对于提示词的考察遇到两次，基本就是宏观上，问你有没有什么写提示词的技巧，让你自由发挥。

###### 1.3.1 如何设计 Prompt 来提升任务稳定性与准确性？

📝 **答案：** 我会把 Prompt 当成一份任务协议来设计，而不是简单描述一句“你要做什么”。

**首先，需要明确任务目标、输入含义、执行规则、边界条件和输出格式，尽量减少模型自行猜测**。例如分类任务要明确标签集合、每个标签的判定标准，以及信息不足或标签冲突时如何处理。

**其次，为模型提供与任务相关且可信的上下文**。事实型任务可以结合 RAG、数据库或工具查询，并要求模型只根据提供的证据回答；证据不足时应明确返回“不确定”或请求补充信息，而不是自行编造。对于规则复杂或容易混淆的任务，可以提供少量 Few-shot 示例，尤其要覆盖正常情况、边界情况和反例。

**对于复杂任务，不建议让模型在一次调用中同时完成理解、检索、决策和执行，而应拆分成多个步骤**，例如：

`意图识别 → 信息检索 → 生成候选结果 → 结果校验 → 输出或重试`

每个步骤都应有明确的输入和输出。下游程序需要使用结果时，应尽量采用 JSON Schema、枚举或函数调用等结构化输出，并在程序侧继续做字段、类型、业务规则和权限校验。

最后，要通过评测而不是主观感觉判断 Prompt 是否有效。可以建立包含正常、边界和历史失败样本的测试集，将 Prompt、模型版本和参数一起版本化，通过任务成功率、事实准确率、格式合法率、工具调用正确率等指标进行回归测试。

需要注意的是，Prompt 只能降低模型行为的不确定性，不能提供绝对保证。事实核验、工具权限、API 重试、业务规则和高风险操作确认，仍然需要由程序和系统机制完成。

[选自202607宇树科技Agent开发一面](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnjxTkZuUteFZ7AgpwF9MJnh)

###### 1.3.2 在项目过程中，怎么去做提示词的压缩和裁剪？

选自[2026年12月夸克千问Agent开发二面](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcn4Ivec0GO5wU7GEfxONT1Tf)。 答案我就写在面经里了，辛苦大家点击链接跳转观看。

---

## 2. Context-Engineering

### 一、context eng的演变

如果说 2023 年大家还在讨论“prompt engineering 有没有技巧”，那么到 2025–2026 年，越来越多团队开始把重点转向 context engineering。原因很现实：模型本身变强了，但真实系统失败越来越少是因为“不会写一句话”，越来越多是因为“上下文给错了、给多了、给乱了、给旧了、给得不合时机”。

**第一，Agent 场景下，模型输入不再只是用户问题和一段 system prompt**。它可能还包括：

- 角色与权限规则；
- 历史对话；
- 用户记忆；
- 检索证据；
- 工具 schema；
- 工具调用结果；
- 计划与待办状态；
- 文件路径、URL、数据库游标；
- 长任务中的阶段摘要。  
这意味着“输入设计”从单条 prompt，升级成了一个多源上下文组装问题。

**第二，大上下文不再昂贵到完全不能用，但也远没到可以随便乱塞的程度**。上下文越大，延迟和成本越高；关键信息越分散，模型越可能找不到重点。所以真正决定效果的不是“有没有很多上下文”，而是“在当前这一轮，最应该让模型看到什么”。

**第三，很多 Agent 失败都不是“不会推理”，而是“推理时看到了错误的东西”**。比如：

- 历史任务状态过时；
- 工具结果没有清洗；
- 旧计划和新计划同时存在；
- 权限规则埋在很后面；
- 用户偏好与系统规则冲突；
- 大段无关日志稀释注意力。  
这时候继续死磕 prompt wording 意义不大，必须上升到 context engineering。

第四，Anthropic 在 2025 年专门写了 *Effective context engineering for AI agents*，OpenAI 在新 Responses API 里强调 compaction，Anthropic models list 直接暴露 context management/compact 能力，Gemini 文档也在 Live/session 场景里讨论 summary 与 context reuse。行业已经用产品和 API 设计告诉你：上下文管理是第一等公民。

一个比较能打动面试官的表述是：

> 💡 我们后来发现系统表现不稳定，主要不是 prompt wording 问题，而是上下文来源太多：系统规则、用户历史、检索证据、工具结果全混在一起。于是我们做了三件事：第一，把规则、证据、状态分区标注；第二，把长会话历史压成结构化 summary/state，而不是全量回灌；第三，对大文件和大工具集改成 just-in-time 加载，只在需要时注入。这样做以后，模型在复杂任务中的稳定性提升明显，token 成本和延迟也降了。”

### 二、先给一个工作定义

**Context engineering 是围绕模型运行时输入进行选择、分层、排序、压缩、生命周期管理和验证的工程过程。**

这个定义里有六个关键词。

- **选择**：哪些内容应该进当前轮上下文；
- **分层**：系统规则、任务目标、证据、示例、工具、状态要不要分区；
- **排序**：什么靠前，什么靠后；
- **压缩**：哪些历史要总结，哪些原文要裁剪；
- **生命周期管理**：哪些信息只在当前轮有效，哪些应跨轮保留；
- **验证**：输入给模型的上下文是否完整、冲突、过时或越权。

你会发现，prompt engineering 更像在优化“怎么说”，而 context engineering 更像在优化“让模型在这一刻看到什么、以什么结构看到”。

### 三、Prompt Engineering 与 Context Engineering 的关系

很多面试官会直接问：“它俩区别是什么？”  
一个好回答不是非此即彼，而是分层。

#### 1. Prompt Engineering：偏表达与约束

它更关注：

- 任务怎么描述；
- 规则怎么写；
- 输出格式怎么限定；
- few-shot 示例怎么给；
- 工具说明怎么表述。

你可以把它看成“单轮输入文本与 schema 的设计”。

#### 2. Context Engineering：偏运行时状态组织

它更关注：

- 本轮需要哪些外部证据；
- 历史对话保留到什么程度；
- 用户记忆是否应该注入；
- 工具结果是原样放入还是摘要后放入；
- 哪些内容应该常驻前缀，哪些按需加载；
- 多轮长任务怎么做 compaction。

它是“整个运行时输入系统的设计”。

#### 3. 两者不是替代关系

没有好的 prompt，context 再好也会执行歪；  
没有好的 context，prompt 再漂亮也会在错误材料上发挥。  
真正生产里，两者必须一起设计。你在面试里如果能说出这句，通常会被认为理解比较到位。

### 四、Context 到底由哪些东西组成

![](02_Context-Engineering_images/Context Engineering/I3gTbIgbqocXa6xAK6pc0q6AnGd.svg)

真正线上系统里的“上下文”，远比你在 playground 里看到的大。常见来源包括：

#### 1. 规则上下文

system / developer prompt、产品规则、权限边界、品牌风格、合规要求、审批策略等。这些通常优先级最高，且适合做稳定前缀。

#### 2. 任务上下文

用户当前请求、本轮输入数据、UI 状态、用户选中的文件、当前页面信息、表单字段等。这是最直接的任务驱动信息。

#### 3. 知识上下文

检索召回的文档、FAQ、业务规则、数据库结果、网页搜索结果、代码片段等。它决定模型有没有事实依据。

#### 4. 状态上下文

会话历史、计划进度、已完成步骤、待办事项、失败重试次数、上次工具返回、临时变量等。Agent 系统特别依赖这类上下文。

#### 5. 记忆上下文

长期用户偏好、组织信息、项目约定、个人习惯、长期目标等。这类上下文不是每轮都变，但也不该每轮全部注入。

#### 6. 工具上下文

工具名字、用途、参数 schema、权限边界、调用代价、返回格式、错误定义。工具越多，这部分越容易成为上下文膨胀源。

### 五、Context Engineering 的核心问题：不是收集，而是取舍

#### 1. 相关性

只有和当前任务相关的内容才值得放进上下文。  
“可能以后有用”通常不等于“这一轮值得占 token”。  
一个很常见的失败是把所有历史工具结果都原样放进去，结果真正关键的最新状态反而被淹没。

#### 2. 权威性

上下文里可能同时出现用户猜测、过时 FAQ、数据库实时结果、缓存旧状态、检索文档片段。它们的可信度不同。  
Context engineering 不只是选“相关的”，还要选“优先相信谁的”。  
这点在企业知识问答、配置规则执行、财务与运营类 Agent 场景尤其关键。

#### 3. 新鲜度

时间敏感信息必须优先新鲜来源。  
例如：

- 最新库存；
- 当前配置；
- 当日政策；
- 实时工单状态；
- 最新 commit。  
把旧版本内容和新版本内容一起塞进去，模型大概率会混。

#### 4. 冗余与冲突

重复信息会浪费预算，冲突信息会让模型摇摆。  
上下文里最危险的不是“缺一点”，而是“多了两份互相打架的版本”。

#### 5. 时机

Anthropic 的 context engineering 文章强调“just in time”思路：不要预先把所有可能有用的信息都塞进上下文，而是保留轻量引用（如文件路径、查询、URL、ID），等模型真正需要时再加载。这一思路对大型代码库、长文档、多工具 Agent 特别重要，因为它能显著降低上下文膨胀。

### 六、常见的上下文组织模式

#### 模式 1：稳定前缀 + 动态后缀

把长期稳定的信息（角色、规则、工具说明）固化成前缀；把用户请求、实时数据、检索结果作为动态后缀插入。  
这样既利于缓存命中，也更利于维护版本。

#### 模式 2：计划状态与执行日志分离

很多 Agent 会把“计划”“中间观察”“工具日志”全混在一起，导致模型越跑越乱。  
更好的方式是把：

- 当前计划；
- 已完成步骤；
- 当前可行动作；
- 最近一次关键观察；  
提炼成结构化状态，而不是把完整执行日志原样喂回去。

#### 模式 3：证据区与规则区分离

在 RAG/知识问答里，把“你必须遵守的规则”和“你可以参考的证据”混写，模型容易误读。  
最好单独标注：

- 规则区：输出必须遵守；
- 证据区：回答只能依据；
- 无证据时：返回 cannot_answer。

这种设计对减少幻觉很有效。

#### 模式 4：按需加载工具描述

工具很多时，不应每轮都把几十上百个工具 schema 全塞给模型。2025 年 Anthropic 提出的 tool search / programmatic tool calling，以及 MCP 生态的一些实践，本质都在解决“工具描述过大”的上下文负担。  
真正要学会的是：  
不是让模型从一开始就看到所有工具，而是让它在需要时发现、检索或装载工具。

### 七、Context Engineering 的关键手法

#### 1. 选择：只保留当前决策所需最小充分信息

这是最核心的一条。上下文不是越多越完整，而是越接近“最小充分集”越好。  
所谓最小充分，就是：

- 足够回答当前问题；
- 但不额外引入过多噪声与冲突。

#### 2. 排序：关键信息位置要显眼

考虑到长上下文利用率问题，最关键的规则与证据最好靠前放置或显式标注。  
“重要信息埋在长文档中间”是上下文设计的大忌。

#### 3. 压缩：把历史从“原文”变成“状态”

尤其是长任务和多轮会话，不可能永久保留原始历史。更常见做法是把历史压成：

- summary；
- task state；
- user preference memory；
- unresolved issues。

OpenAI 的 `/responses/compact`、Anthropic 的 context management capability、Gemini Live 的 summary/resumption 思路都说明：压缩正在从应用技巧变成平台能力。

#### 4. 标注：告诉模型每一块上下文是什么

你给模型一堆文本，它未必知道哪部分是规则，哪部分是证据，哪部分是示例。  
强烈建议做明确区块标注，例如：

- `<rules>`
- `<task>`
- `<evidence>`
- `<memory>`
- `<tool_result>`
- `<output_schema>`  
这既提升可读性，也提升模型解释输入的准确性。

#### 5. 清理：删除失效内容

过期状态、旧版本规则、失败工具日志、重复检索片段都应该及时清掉。  
一个成熟系统不会“越积越多”，而会“边跑边清”。

### 八、Context Engineering 与 RAG、Memory 的边界

#### 1. RAG 不是全部 context engineering

RAG 更偏“如何拿到外部知识”。  
Context engineering 则还包括：

- 是否需要这个知识；
- 用原文还是摘要；
- 放在上下文哪个位置；
- 和规则、历史、工具结果怎么拼；
- 是否只保留引用而不直接展开。

#### 2. Memory 也不是全部 context engineering

Memory 关注跨轮持续信息，例如用户偏好、长期目标、项目背景。  
Context engineering 则决定：

- 哪些记忆该在本轮注入；
- 以什么粒度注入；
- 何时不要注入；
- 记忆与实时输入冲突时谁优先。

#### 3. Context Engineering 是上层调度框架

一个常见的好回答是：  
RAG 负责“找”，memory 负责“记”，context engineering 负责“在这一轮怎么用”。  
这句很适合面试。

### 九、调试上下文问题：真实系统里最值钱的能力

很多同学一出问题就改 prompt wording，但 context bugs 往往更致命。你应该学会这样排查：

#### 1. 看遗漏

模型答错，是不是因为关键规则或关键证据根本没进上下文？

#### 2. 看污染

是不是塞了太多不相关历史、重复片段、旧版本状态？

#### 3. 看冲突

是不是两份互相矛盾的信息同时存在？

#### 4. 看顺序

最关键的信息是不是位置不显著、被埋在中间？

#### 5. 看粒度

工具结果是不是太原始，模型难以消费？  
或者相反，摘要过头，把关键字段丢了？

#### 6. 看生命周期

这段历史本轮还该不该保留？  
用户偏好是不是在当前任务反而构成干扰？

一个成熟工程师不会只问“prompt 怎么改”，而会先问“这轮上下文是不是从根上组错了”。

### 十、高频面试题与答题要点

#### 问题 1：什么是 context engineering？

是对模型运行时输入进行选择、排序、压缩、生命周期管理和验证的工程过程。

#### 问题 2：它和 prompt engineering 的区别是什么？

Prompt 更偏单轮任务描述与约束表达；context engineering 更偏整个运行时上下文系统如何组装和管理。

#### 问题 3：为什么现在越来越强调 context engineering？

因为模型和 Agent 的输入来源变多，失败往往来自错上下文、旧状态、噪声和冲突，而不仅是提示词措辞。

#### 问题 4：上下文越多越好吗？

不一定。过多上下文会增加噪声、成本和延迟，还可能降低关键信息密度。

#### 问题 5：如何提高上下文质量？

确保相关性、权威性、新鲜度，减少冲突和冗余，关键内容显式标注并放在更显著位置。

#### 问题 6：RAG 和 context engineering 有什么关系？

RAG 提供知识来源，context engineering 决定这些知识是否该用、如何拼接、如何压缩、放在哪里。

#### 问题 7：多轮 Agent 为什么需要状态压缩？

因为原始历史会快速膨胀并污染上下文，应该把历史转成结构化状态或 summary。

#### 问题 8：什么是 just-in-time context？

先保留轻量引用，在模型真正需要时再加载详细内容，避免预先塞入大量可能无关的信息。

#### 问题 9：为什么要分区标注上下文？

为了让模型区分规则、证据、示例、记忆和工具结果，降低误读输入结构的风险。

#### 问题 10：怎样判断一个问题是 prompt bug 还是 context bug？

如果目标和约束表达已经清晰，但模型在错误材料上推理、混用旧状态或无视证据，通常更像 context bug。

### 十一、常见误区

第一个误区，是以为 context engineering 只是“多加一点背景资料”。其实它更强调取舍、排序和生命周期。

第二个误区，是把历史消息全量保留当成“信息更完整”。现实里这常常意味着更脏、更慢、更冲突。

第三个误区，是不区分规则与证据。模型会把它们混读，导致既不听规则，也不忠于证据。

第四个误区，是认为有了大上下文就不用做 context engineering。恰恰相反，窗口越大，选择和压缩越重要。

### 十二、我的一些思考

**Context engineering 不是“给更多信息”，而是“在这一轮给最对的信息，以最合适的结构给出去”。**

**RAG 负责找信息，memory 负责留信息，context engineering 负责让模型在当前时刻真正用对信息。**

### 资料来源与延伸阅读

#### 官方与工程文章

1. Anthropic, *Effective context engineering for AI agents*  
[https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
2. Anthropic, *Effective harnesses for long-running agents*  
[https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
3. Anthropic Models List（context management capabilities）  
[https://docs.anthropic.com/en/api/models-list](https://docs.anthropic.com/en/api/models-list)
4. Anthropic Prompt Engineering Overview  
[https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
