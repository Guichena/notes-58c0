# LLM基础

> **模块**：01_LLM基础/01_LLM基础.md  
> **构成**：9 个知识点合为一篇，按顺序编号  
> **规模**：约 3,337 行  |  **生成**：2026-11-12

## 目录

1. Transformer与LLM基础
2. 推理机制与采样参数
3. 上下文窗口与KVCache
4. 幻觉与对齐
5. 模型选型与路由
6. 模型训练与后训练
7. 模型与硬件
8. 微调基础
9. 推理加速

---

## 1. Transformer与LLM基础

### 一、这篇在面试里到底考什么

校招里问 Transformer 与 LLM 基础，面试官通常不是想听你复述Attention Is All You Need那篇论文的摘要，而是想判断四件事。

**第一，你是否真的理解 LLM 的工作对象是 token 序列，而不是句子，知识点这种人类语义单位**。很多同学会直接说大模型理解自然语言，但工程上模型首先处理的是离散 token，经 tokenizer 编码后进入 embedding，再通过一层层注意力与前馈网络做变换，最后输出下一个 token 的概率分布。你只要把这个链条说顺，面试官会立刻判断你不是只会背概念。

**第二，面试官在看你有没有从架构到工程的连接能力**。比如为什么 Transformer 能替代 RNN/CNN，不只是因为效果更好，更关键是它取消了时间步递归依赖，训练时更容易并行；而推理时虽然生成仍是逐 token 自回归，但注意力机制让模型在每一层都能直接访问历史上下文。你如果能继续补一句代价是注意力随序列长度增长会带来较高的时间与显存开销，这也是长上下文、KV Cache、prefix cache 等工程优化出现的背景，那就从算法题切到了工程题。

**第三，面试官想确认你理解LLM 的能力从哪里来**。如果你只会说参数量大，所以智能，这属于不及格答案。更好的回答应该是：自回归预训练让模型在海量语料上学习统计规律；规模扩展让模型获得更强的模式归纳和 in-context learning 能力；后续的指令微调、偏好对齐、工具接入，则把原始语言能力变成更可用的产品能力。也就是说，LLM 的能力不是某个单点 magic，而是架构 + 数据 + 训练目标 + 规模 + 后训练共同作用的结果。

**第四，面试官经常借这道题看你后续能不能接更深的问题**。比如你如果说到 RoPE，可能会被追问长上下文；说到 decoder-only，可能会被问为什么生成式应用偏爱它；说到 tokenizer，可能被问中文分词、代码 token、上下文成本；说到 scaling，可能被问为什么更大模型并不总是生产最优解。所以这道题表面是基础，实际是 02 章后续所有问题的入口。

一个比较好的答法是：先用一句话定义 LLM，再讲 Transformer 的核心部件，再讲为什么大多数生成式产品采用 decoder-only 架构，最后补一嘴训练与后训练阶段。这样层次最清楚，也最容易被继续追问。

**给大家一个面试的口语版话术：**

> 💡 大语言模型本质上是基于 Transformer 的自回归语言模型，核心任务是根据已有 token 预测下一个 token。Transformer 相比 RNN 更适合大规模并行训练，核心模块包括 embedding、位置编码、self-attention、FFN、残差和归一化。现代生成式产品大多采用 decoder-only，因为 next-token 目标和开放式生成高度一致。LLM 的能力来自预训练、规模扩展和后训练对齐，不是单纯因为参数大。它强在通用模式归纳和 in-context learning，但也因为参数里不是显式知识库，所以会出现幻觉、过时和格式不稳定，这就是为什么后续需要 prompt engineering、context engineering、RAG 和工具调用。

### 二、总体看一下这块的思维导图

![](01_Transformer与LLM基础_images/Transformer 与 LLM 基础（重要）/Guc1bkX40ooy6ZxkSsYc3GOOn0d.svg)

从应用工程视角看，LLM 最核心的事情其实只有一句：给定一个 token 序列，预测下一个最可能出现的 token。模型并不知道摘要问答SQL 生成Agent 规划这些任务标签，它只是通过训练把大量任务都转写成基于上下文继续生成的统一接口。提示词工程、上下文工程、结构化输出、工具调用，本质上都是在操控这个统一接口。

因此理解 LLM 最好的方式，不是把它看成神秘智能体，而是把它看成一个非常强的条件概率模型：  
P(next_token | previous_tokens, parameters)

这条公式背后藏着三层重要认识。第一，模型能力高度依赖上下文组织方式，这就是为什么 prompt/context engineering 重要。第二，模型输出不是一个唯一答案，而是一个概率分布，所以采样参数会影响生成风格与稳定性。第三，模型参数里存的是压缩后的统计规律，不是一条条可显式索引的事实表，所以它会幻觉、会过时、会在缺证据时自信生成。

### 三、什么是语言模型，什么又是大语言模型

语言模型不是从大模型时代才出现的。传统 n-gram、RNN/LSTM、Transformer 其实都可以做语言建模。所谓语言建模，就是估计一个 token 序列出现的概率，或者更具体一点，给定前文预测后文。大语言模型中的大，首先体现在参数规模、训练数据规模和训练算力规模上，其次体现在它不是只针对单一任务训练，而是在通用语料上做大规模预训练，再通过后训练适配更多任务。

这里要特别区分三个层次。

**第一层是 tokenizer**。模型并不直接读取字和词，而是读取 token。不同 tokenizer 策略会影响上下文成本、跨语言表现、代码表现与边界处理。比如中英文混合、特殊符号、长数字串、URL、代码片段，经常会被切成很不同的 token 序列，直接影响成本和效果。面试里如果问为什么同一段中文在不同模型里 token 数不一样，根本原因就在 tokenizer 不同。

**第二层是 base model**。它通过预训练学到语言分布和广泛世界知识，但未必擅长听指令，也未必稳定遵循格式。你可以把它理解为很会续写，但不一定好用。

**第三层是 instruction/aligned model**。通过监督微调、偏好优化、规则约束等方法，模型更愿意遵循系统指令、拒绝不当请求、输出更贴近产品预期的回答。很多校招同学把LLM与Chat 模型画等号，这是不精确的。Chat 只是 LLM 的一个对话化产品形态。

> 从面试答题看，一个非常好的表述是：**大语言模型不是简单把参数堆大，而是把通用语言建模、可迁移能力、上下文内学习、对齐与工具接入叠加到了同一个模型接口上。这样既体现理论理解，也自然过渡到后续 Agent 话题**。

### 四、Transformer与RNN/LSTM/CNN的对比

Transformer 成为 LLM 底座，有两个最重要的理由：表达能力与并行效率。

RNN/LSTM 的问题在于，序列建模天然按时间步递归，虽然可以处理变长序列，但训练时很难大规模并行，而且长距离依赖容易衰减。CNN 虽然并行性更好，但在建模远距离依赖时通常需要堆很多层，感受野扩展不够直接。Transformer 用自注意力直接让当前位置与序列中其他位置建立联系，从路径长度上看，任意两个位置之间的信息交互都更短，这对捕获长程依赖非常关键。论文《Attention Is All You Need》给出的核心贡献并不只是提出了 attention，而是把序列建模的主干彻底换成了 attention-first 的结构。

但只说注意力更强还不够，面试官一般更想听到工程含义。Transformer 在训练阶段的并行性非常好，因为整个输入序列可以同时经过线性变换、同时计算 attention score、同时做前馈网络。这使得它更适配 GPU/TPU 这种大规模并行硬件，成为后续 scaling 的前提。很多时候不是某个架构理论最优，而是它在硬件上最容易被放大，最终就赢了。

当然，Transformer 也不是没有代价。**标准自注意力的计算与显存开销通常会随着序列长度增长而显著增大，所以大上下文成本很高**。今天大家讨论长上下文、稀疏注意力、滑动窗口、KV Cache、prefix caching，本质都在修这个代价。也就是说，Transformer 赢在统一、强大、可扩展，但它的工程负担从来没有消失，只是被后续优化体系接住了。这是一种工程上的trade-off

### 五、Transformer 的核心模块，面试要讲到什么粒度

#### 1. Embedding：把离散 token 映射到连续空间

Tokenizer 输出的是 token id，本身只是整数。Embedding 层把每个 token 映射成高维向量，让模型可以在连续空间里学习相似语义、相似模式、相似上下文角色。比如北京和上海的某些维度可能更接近，for和while在代码语料里也会形成相似模式。

面试里一般不需要把 embedding 讲得太数学化，但最好强调两点。第一，embedding 不是词典释义，而是训练中不断更新的分布式表示。第二，embedding 只解决是什么 token，不解决它在第几个位置，位置问题需要单独编码。

#### 2. Position Encoding / RoPE：让模型知道顺序

如果只有 token 向量，没有位置信息，那么我喜欢你和你喜欢我对模型来说几乎只是同一堆词袋。Transformer 本身没有天然顺序感，所以必须引入位置编码。早期论文使用的是绝对位置编码，后来很多 LLM 使用相对位置编码或 RoPE（Rotary Position Embedding）。RoPE 的常见优点是更适合外推到更长上下文，在现代 LLM 中非常常见。

面试里不一定非要背 RoPE 公式，但你要知道：位置编码不是可有可无，而是序列建模不可缺的顺序先验。如果被问为什么长上下文外推会出问题，你也可以从位置编码泛化能力切入。

#### 3. Self-Attention：Transformer 的心脏

Self-attention 的直觉非常重要。对序列中某个位置来说，它在生成新的表示时，不只看自己，还会参考当前上下文里哪些 token 更相关。通过 Q、K、V 三组向量，模型先计算我该关注谁，再汇聚这些位置的信息，得到新的上下文表示。

经典公式可以写成：

Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V

你不一定要把公式背得一字不差，但建议知道每一项的意义：  
Q 是我当前想找什么，K 是别人身上有哪些可匹配的特征，V 是别人真正携带的信息。  
softmax 把相关性归一化成权重，最后对 V 做加权求和。

面试里最容易被追问的是两个点。第一，为什么要除以 sqrt(d_k)？因为维度增大时点积幅度会变大，softmax 更容易饱和，缩放能让训练更稳定。第二，为什么 multi-head 有用？因为不同 head 可以学习不同关系，比如语法依赖、共指关系、代码作用域、局部模式、长程依赖等。不是每个头都负责一种固定语义，但多头机制确实扩大了表征子空间。

#### 4. FFN、Residual、LayerNorm：不是配角

很多同学只会讲 attention，却忽略 FFN、残差连接和归一化。其实在现代 Transformer 里，这些模块都很关键。FFN 为每个位置提供更强的非线性变换能力，可以理解为 attention 负责信息路由，FFN 负责局部加工。残差连接帮助梯度稳定传播，也让网络更容易训练更深。LayerNorm 则帮助数值分布更稳定。

如果面试官问Transformer 为什么能堆很深，你完全可以回答：不仅因为 attention 机制本身强，还因为有残差、归一化、优化器和训练工程共同支撑。真正的大模型从来不是单模块胜利，而是系统工程胜利。

#### 5. Masked Self-Attention：为什么 decoder-only 能做生成

对于生成式模型，训练和推理都必须保证当前位置不能偷看未来 token。这就是 causal mask / autoregressive mask 的意义。它会把未来位置屏蔽掉，使模型只能基于历史上下文预测下一个 token。于是模型学到的是严格的左到右生成机制。

这点非常关键，因为很多生成式产品本质上依赖的就是这个机制：输入 prompt，模型按顺序往后续写。面试里如果问为什么 decoder-only 架构适合聊天生成，你只要抓住三点：统一的 next-token 目标、天然适合开放式生成、工程生态成熟。

### 六、为什么今天大多数生成式产品偏爱 decoder-only

BERT 这类 encoder-only 模型非常擅长理解任务，比如分类、匹配、抽取；T5/BART 这类 encoder-decoder 模型在翻译、摘要、文本到文本任务上也很强。但在通用聊天、代码生成、Agent 执行、开放式续写这些场景里，decoder-only 最终成为主流，原因主要有四个。

第一，训练目标统一。decoder-only 直接做自回归语言建模，和实际生成任务非常一致。它不用把训练目标拆成复杂的多任务形式，预训练与部署链路更统一。

第二，扩展性强。随着参数、数据和算力规模增大，decoder-only 在通用能力、few-shot/in-context learning、代码与工具使用上的收益非常明显。GPT-3 把这种只靠大规模语言建模就出现强迁移能力的现象推到了行业中心。

第三，产品接口简单。对上层应用来说，给上下文，继续生成就是一个足够统一的接口。无论问答、写作、规划、JSON 抽取还是工具调用，都可以映射到这个接口上。

第四，生态成熟。推理框架、KV Cache、prefix cache、流式输出、采样控制、函数调用等能力，今天基本都围绕 decoder-only LLM 形成了完整工业链。

这并不意味着 encoder-only 或 encoder-decoder 过时。做 rerank、embedding、分类、小模型理解任务时，它们仍然很重要。校招面试里更稳妥的表述是：生成式主流程偏好 decoder-only，但生产系统往往是多模型协同，而不是一个 decoder-only 模型包打天下。

### 七、预训练、规模扩展与能力形成

#### 1. 预训练目标：next-token prediction 为什么足够强

很多初学者会疑惑：只做预测下一个 token这么简单的任务，为什么能学出问答、翻译、代码、推理甚至工具使用能力？这恰恰是 LLM 最反直觉也最重要的地方。因为海量文本本身已经隐含了知识、任务格式、推理痕迹、程序模板、对话模式和世界规律。模型在压缩这些分布时，学到的不是某个单独任务，而是任务之间共享的统计结构。

当然，这里一定要讲清楚边界。next-token prediction 学到的是分布规律，不是严格逻辑引擎，也不是事实数据库。所以模型可以看起来会推理，但并不保证每次都对；可以像是知道知识，但知识可能过时或混杂。你在面试里把这层边界说出来，会显得非常清醒。

#### 2. Scaling Laws：为什么大模型突然好用了

经验上，模型规模、数据规模、训练计算量增加，性能会遵循一定的可预测趋势。Kaplan 等人的 scaling laws 说明 loss 会随着模型、数据、算力扩展而按幂律下降；Hoffmann 等人的 Chinchilla 工作进一步强调，在固定算力预算下，参数量和训练 token 都要一起扩展，很多只堆参数不喂足数据的模型其实是 undertrained。这个认知对工程很重要：不是模型越大越值钱，而是要看训练是否 compute-optimal。

对校招面试来说，不需要你背论文细节，但最好知道两个结论。第一，大模型能力的跃迁很大程度上来自规模化训练，而不是某一个小技巧。第二，规模扩展不是无脑增参数，数据量和计算预算同样关键。你如果能顺口补一句今天生产选型更关注单位成本智能，而不是绝对参数规模，会和 08 章模型路由自然衔接。

#### 3. In-Context Learning：为什么 few-shot 会生效

GPT-3 让行业意识到：模型可以仅通过上下文里的指令和示例，在不更新参数的情况下快速适应新任务。这种能力通常被称为 in-context learning。你可以把它理解为模型在运行时临时模拟某种任务分布，而不是把新知识真的写回参数。

这个点对 Agent 和应用开发非常重要。因为提示词、示例、工具 schema、检索结果，本质都是在利用模型的 in-context learning 能力进行运行时编程。面试里如果被问Prompt Engineering 为什么有用，根子就在这里。

### 八、现代 LLM 不止一种：你至少要知道这些分类

#### 1. 按任务接口分：encoder-only / decoder-only / encoder-decoder

最常见的问法是：三种架构怎么区分，分别适合什么任务？  
一个稳的回答如下：

- encoder-only：更擅长理解输入整体语义，常用于分类、检索、匹配、embedding、rerank；
- decoder-only：更擅长开放式生成，是聊天、代码生成、Agent 的主流底座；
- encoder-decoder：把输入理解与输出生成分开，在翻译、摘要、结构化文本转换任务中很自然。

#### 2. 按参数激活方式分：Dense 与 MoE

Dense 模型每个 token 都走全部参数路径，MoE（Mixture of Experts）则只激活部分 expert。MoE 的核心优势是以较低推理成本获得更大总参数容量，缺点则是训练、路由、系统复杂度更高。校招基础面不一定深挖，但如果你面的是平台/推理方向，这个点常会被问到。

#### 3. 按输入模态分：纯文本、多模态、工具增强

到 2026 年，主流商用模型普遍已支持文本、图像甚至音视频等多模态输入，同时提供结构化输出、函数调用、Web/File/Computer Use 等工具能力。这里要注意一个面试陷阱：多模态不等于 Agent。多模态只是输入输出能力扩展；Agent 还涉及规划、状态、工具循环、终止条件等更高层机制。

### 九、面试高频题：怎么答更像工程同学

#### 问题 1：Transformer 为什么比 RNN 更适合大模型时代？

回答重点不是更先进，而是训练可并行、长程依赖路径更短、更适合 GPU/TPU 扩展。再补一句代价是长序列成本高，所以需要缓存与长上下文优化，就有工程味了。

#### 问题 2：Self-Attention 在干什么？

一句话解释：对每个位置，模型都在根据当前查询内容，从上下文里找最相关的 token，并把它们的信息加权汇总成新的表示。然后再看公式与 Q/K/V 含义。

#### 问题 3：为什么要多头注意力？

因为单一注意力子空间不够，多头让模型从多个表示子空间并行捕捉不同类型的关系，提高表达能力与稳健性。

#### 问题 4：为什么大多数聊天模型是 decoder-only？

因为训练目标和开放式生成高度一致，工程接口统一，生态成熟，扩展性强。不要只回答因为 GPT 成功了。

#### 问题 5：next-token prediction 为什么能学到推理？

因为训练语料中隐含了大量任务模式与推理轨迹，模型通过压缩这些分布获得可迁移能力。但这不是严格逻辑保证，所以推理能力强不代表永远正确。

#### 问题 6：参数越大越好吗？

不是。能力通常会随规模增长，但是否值得取决于数据、训练是否充分、推理成本、延迟预算、业务指标。生产上追求的是质量/成本/延迟的 Pareto 最优，而不是盲目追大。

#### 问题 7：Tokenizer 为什么很重要？

因为它直接影响 token 成本、跨语言表现、代码表现和上下文利用率。同样内容在不同 tokenizer 下 token 数可能差很多，成本与效果都会变。

#### 问题 8：位置编码为什么必须有？

因为注意力本身对顺序不敏感，没有位置信息就无法区分你喜欢我和我喜欢你这种顺序差异。

#### 问题 9：LLM 里的知识是怎么存的？

更准确地说，是以分布式参数形式压缩在模型权重里。它不是可直接查询的数据库，所以会过时、会混淆、会在细粒度事实题上出错。这也是 RAG、工具调用、检索验证存在的原因。

#### 问题 10：为什么说 Transformer 是基础，但不是全部？

因为今天的可用 LLM 产品除了模型架构，还依赖 tokenizer、训练数据、后训练对齐、推理系统、缓存、工具协议、评测与治理。只会讲架构，但讲不出系统，就很难做真实应用。

### 十、这一块八股怎么结合自己的项目讲

如果面试官问你做过什么 LLM 项目，不要上来就说我们用某某模型做了智能问答。更好的讲法是把底层原理映射到设计决策。

例如你可以这样说：  
我们当时选 decoder-only 指令模型作为主生成器，因为目标是开放式问答和工具调用，而不是单纯分类。之所以特别关注 tokenizer 和上下文长度，是因为业务输入里有大量中英文混合文档和代码片段，token 成本很敏感。上线后我们把系统 prompt、知识片段、工具 schema 都视为运行时上下文的一部分来管理，本质上是在利用模型的 in-context learning 能力，而不是把所有业务逻辑都写死在参数里。

这段话的价值在于，它把Transformer/LLM 基础翻译成了真实项目语言。面试官一听就知道你不是背论文，而是真的理解为什么这些基础会影响产品设计。

### 十一、常见误区与追问陷阱

第一个误区，是把 attention 说成模型在理解重要词。这太拟人了。更准确的说法是：attention 是一种可学习的信息路由与权重分配机制，不保证可解释，不等于人类注意力。

第二个误区，是把参数量当成唯一指标。今天很多小模型在特定任务上性价比更高，尤其在工具调用、结构化抽取、分类与路由场景。工程上看的是任务适配，而不是排行榜崇拜。

第三个误区，是把模型知道很多误解成模型内置事实库。这会让你在幻觉、RAG、工具调用等问题上全线崩掉。一定要记住：参数存的是压缩分布，不是可直接核验的知识表。

第四个误区，是把 Transformer 讲成只有 attention。如果你能主动补充 FFN、残差、归一化、mask、自回归目标，回答立刻比普通八股高一个档次。

### 十二、截至 2026-04，你还应该补上的现代视角

到 2026 年，大模型基础认知和 2023 年相比有一个明显变化：大家不再只讨论模型会不会，而开始讨论模型以什么代价、在什么上下文、通过什么工具链完成任务。

OpenAI 当前文档把模型区分为 reasoning 与非 reasoning 家族，并把模型选型、reasoning effort、structured outputs、tool use 都纳入统一接口；Anthropic 在 2025 年后明显强化了 context engineering、advanced tool use、programmatic tool calling 等工程主题；Google Gemini 文档则把 long context、thinking、function calling、structured outputs、context caching 作为第一层能力来讲。你会发现，行业的关注点已经从Transformer 架构本身转向围绕 Transformer 的整套应用系统。

但这不意味着基础不重要。恰恰相反，越是到 Agent 时代，越需要把基础打牢。因为你做任何一层能力封装，最终都绕不开几个底层事实：模型处理的是 token；生成依赖自回归；上下文有预算；长上下文有代价；参数里不是可靠知识库；推理系统的缓存和路由决定了成本与延迟。LLM与大模型应用基础这一章后面所有内容，其实都只是这些底层事实在不同工程问题上的展开。

### 资料来源与延伸阅读

#### 官方与论文

1. Vaswani et al., *Attention Is All You Need*, NeurIPS 2017  
[https://arxiv.org/abs/1706.03762](https://arxiv.org/abs/1706.03762)
2. Brown et al., *Language Models are Few-Shot Learners*, 2020  
[https://arxiv.org/abs/2005.14165](https://arxiv.org/abs/2005.14165)
3. Kaplan et al., *Scaling Laws for Neural Language Models*, 2020  
[https://arxiv.org/abs/2001.08361](https://arxiv.org/abs/2001.08361)
4. Hoffmann et al., *Training Compute-Optimal Large Language Models*, 2022  
[https://arxiv.org/abs/2203.15556](https://arxiv.org/abs/2203.15556)
5. OpenAI Reasoning Best Practices / Reasoning Guides  
[https://developers.openai.com/api/docs/guides/reasoning-best-practices/](https://developers.openai.com/api/docs/guides/reasoning-best-practices/)  
[https://developers.openai.com/api/docs/guides/reasoning/](https://developers.openai.com/api/docs/guides/reasoning/)
6. Anthropic Models Overview  
[https://docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)
7. Gemini Models 文档  
[https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

### 补充 · Transformer 与主流模型速答（B 套）

> 来源：购买资料 B（原文第 15851–15986 行）

#### 2 Transformer

(这一块其实不管在任何书籍，课程或者你去上机构给你的学习路线上，Transformer都占比很大。但是其实我在面试的时候问的确实不多。但还是建议学习一些，特别是想要面一些有点涉及算法的岗位，比如算法工程的同学。另外虽然面试官没有直接问这些问题，但是这些内容时不时在面试中会被提到。比如问你推理加速，提到KV-CACHE的时候，你如果连Transformer的QKV都不知道，肯定KV-CACHE也弄不懂。 比如问你为啥这几年LLM发展这么强大，你就可以提到Transformer的**并行计算**和**长距离依赖** 来谈谈为啥Transformer出来之后AI发展如此迅速。 总之这节虽然不会直接考到，但是建议理解学习的）

##### 2.1 简单介绍Transformer架构

Transformer是最早在2017年在论文《Attention is All You Need》提出的深度学习架构，现在的大语言模型，比如GPT系列，Claude等都是基于Transformer架构设计的。

Transformer的架构由**编码器**和**解码器**组成。它们的基础模块主要由**输入嵌入**，**自注意力机制**，**多头注意力机制**，**前馈神经网络**，**残差连接**与**层归一化**组成。

注意力机制是Transformer最重要的设计，相比于RNN，**解决了并行计算和长距离依赖** 两方面的问题，有更高效的**并行计算能力**和**语义理解能力。**是AI领域的一次重大突破。

 

##### 2.2 编码器和解码器的区别

Transformer的**编码器和解码器**，都是基于**注意力机制**的**序列建模架构**。

**编码器**主要是**用来处理输入序列**，**提取上下文信息并生成表示的**。 **解码器**主要是用**来生成输出序列**。（用途层面）

**编码器**通常处理整个输入序列，因此可以**并行计算所有**的位置表示，**因此它的并行性高，推理速度更快**。 **解码器**大多使用**自回归**的方式，每一步生成一个Token, 无法并行生成多个Token，因此在推理时**速度较慢**。

 关于编解码器更详细的资料，可以参考：[编解码器。](https://blog.csdn.net/weixin_43334693/article/details/130161845)

##### 2.3 Transformer vs RNN

Transformer相比RNN，主要在**并行计算方面**和**长距离依赖**两方面，具有高效的并行计算能力和语义理解能力。

具体来讲：

1.因为RNN处理是逐步进行的，每一步依赖前一步的输出状态，无法并行，训练速度慢。而Transformer基于自注意力机制，可以同时处理整个序列，充分利用GPU的能力，训练速度大幅提升。

2.RNN网络中，容易出现**梯度消失或者爆炸**，**捕捉长距离依赖困难**。而Transformer通过注意力机制，任意两个位置可以直接建立联系，长距离依赖问题得到了显著的缓解。

 

##### 2.4 大模型分词器是什么？

因为大语言模型无法直接理解自然语言，我们需要先把它转成数字输入。分词器就是将**自然语言拆分成更小的单位**（我们把它叫做token），**并将每一个token映射成一个唯一ID**。为后续的词嵌入做准备，从而成为连接起人类语言和模型语言的桥梁。

##### 2.5 Embedding 是什么？

因为大语言模型无法直接理解自然语言，我们需要先把它转成数字输入。Transformer的做法是通过对自然语言进行**分词** + **embedding**得到最终的输入的。具体来讲，embedding就是将离散的输入：**包括分词的id和位置id**，分别通过**词编码**和**位置编码**转换成稠密向量，最后组合成模型输入的过程。                                                                                                                                                                                                               

##### 2.6 注意力机制

###### *2.6.1 简单介绍注意力机制*

（概念简述）注意力机制是在处理一个词时，模型可以关注输入序列的其他词，并根据它们的重要性加权融合信息。

（计算公式简述）它的做法是对每一个词生成3个向量，Q, K, V。Q代表当前词要关注什么， K代表当前词是什么 ， V代表当前词能提供什么信息。 使用Q,K点积计算相似度，使用Softmax得到注意力权重，最后对V进行加权，得到Attention矩阵。

（好处，总结）这个向量可以**捕捉词和词之间的长距离依赖**，信息融合灵活，不依赖固定窗口或顺序，**且并行计算的效率相比RNN更高**。

 

###### *2.6.2 简单介绍多头注意力机制*

多头注意力机制是Transformer架构的核心组件，主要用于增强模型在处理序列数据的表达能力。它的核心思想是：**通过多个注意力头并行计算不同的注意力表示，从而捕捉输入序列和不同位置之间的关系。**

它的主要过程是，生成多组Q,K,V， 对每一组 Q, K, V得到的Attention矩阵进行拼接，得到最终的一个结果。

使用多头注意力机制，可以让模型在**不同的子空间中学习不同的关注模式**，避免单一注意力机制只关注某一种关系的问题，提升模型捕捉**全局信息的能力**。

 

###### *2.6.3 多头注意力机制为何可以增强模型？*

1. **有利于捕捉长距离依赖**。传统的模型比如RNN在处理长文本时容易遗忘前面的信息，而注意力机制可以直接关注任意位置的词，无论距离多远。
2. **动态信息融合**。每个词的表示不再是固定的了，而是根据上下文动态生成，从而得到不同的语义表示。
3. **并行计算。** 注意力机制不依赖于序列顺序，可以一次性处理整个序列，从而极大提升了训练效率
4. **可解释性强**。注意力权重可以可视化，帮助我们理解模型是如何‘思考’的。

 

#### 3 Bert vs GPT？

BERT 和 GPT **是两种基于 Transformer** 的自然语言处理模型，但它们的设计理念和应用方向不同。BERT 使用**编码器结构**，采用**双向上下文理解**，**通过遮盖部分词语进行训练，适合文本分类、问答等理解类**任务。而 GPT 则基于**解码器结构**，采用**自回归方式从左到右生成文本**，擅长**写作辅助**、**对话系统等生成类任务**。简单来说，BERT 更擅长“理解”，GPT 更擅长“生成”。

 

#### 4 简单介绍一下千问模型？

（我在面试阿里前，临时准备的这个问题，害怕面试阿里他会问到，最少不会一问三不知）

**1. 基本定位**

- 千问是一个**多语言、多模态的大模型**，支持文本、图像、音频等输入，具备问答、写作、代码生成、翻译、文档处理等能力。
- 最新版本是 **Qwen3 系列**，于 2025 年发布，参数规模从 **0.6B 到 235B**，涵盖稠密模型和 **MoE架构**模型。

**2. 技术亮点**

- **混合推理机制**：支持“快思考”和“慢思考”两种模式，用户可根据任务选择快速响应或深度推理。
- **MoE 架构**：通过稀疏激活专家子网络，在降低计算成本的同时保持高性能。
- **长上下文能力**：旗舰模型支持 **128K\~1M tokens**上下文，适合长文档和复杂对话。
- **多语言支持**：覆盖 **119 种语言**，全球化应用能力强。
- **训练规模**：基于约 **36万亿 tokens**预训练，后训练包括指令微调、强化学习（RLHF）、思维链优化。 

**3. 应用场景**

- **通用对话与问答**
- **代码生成与编程辅助**（专用模型 Qwen-Coder）
- **多模态任务**：图文理解、OCR、音视频速读（Qwen-Omni、Qwen-VL 系列）
- **企业级智能体**：支持工具调用、Agent框架。

**4. 开源与生态**

- 已在 **魔搭社区、HuggingFace** 等平台开源，支持免费商用，下载量超 6 亿次，形成全球最大开源模型生态之一。

#### 5 简单介绍一下Gemini3模型？

（Gemini3 是目前最强模型，也有面试官直接问你对Gemini3 的理解，看你有没有关注前沿技术，所以我们准备一个Gemini3的模型知识，防止面试问了啥也答不上来的尴尬）

**Gemini 3 的真正差异化优势**

1. **推理深度 + 控制能力**

   - 其它模型也能做 CoT，但 Gemini 3 引入了 **可控推理层级（thinking_level 参数）**，开发者可以动态选择“快思考”还是“慢思考”，而不是固定模式。这意味着它能在延迟和准确率之间灵活权衡，适应不同场景（聊天 vs 科研）。
   - 结合 **Deep Think 模式**，它在博士级推理测试（GPQA Diamond）和 ARC-AGI-2 上刷新纪录，证明不仅能“慢思考”，而且能“正确慢思考”。
2. **原生多模态，不是外挂**

   - 很多模型支持多模态，但大多是“文本为主 + 插件式视觉”。Gemini 3 是 **从架构层面统一文本、图像、视频、音频、代码**，并且在 Video-MMMU、UI理解（ScreenSpot-Pro）测试中大幅领先 GPT-5.1 和 Claude。
   - 这意味着它不仅能“看图回答问题”，还能做 **跨模态推理**，比如结合视频内容和代码逻辑完成任务。
3. **智能体能力的落地**

   - 其它模型也在尝试 Agent，但 Gemini 3 搭配 **Antigravity 平台**，实现了端到端工作流：不仅能调用工具，还能 **自主规划、执行代码、验证结果**，真正从“回答问题”进化到“完成任务”。
   - 这让它更像一个“数字员工”，而不是一个聊天助手。
4. **超长上下文 + 高效架构**

   - 支持 **100 万 tokens 上下文**，并且通过 **MoE（Mixture of Experts）架构 + TPU v6**，在保证性能的同时降低成本。
   - 其它模型即使能处理长上下文，往往会出现性能衰减，而 Gemini 3 在长上下文场景下仍保持高准确率。
5. **安全与透明创新**

   - 引入 **思维签名（Thought Signatures）**，让长链推理过程可验证，适用于金融、法律等高合规场景。这是目前其它模型没有的。

## 2. 推理机制与采样参数

### 一、面试官在考什么

这一题表面看像参数题，实际上面试官主要在考你有没有把模型推理过程拆成几个不同层面来看。

**第一层是模型内部计算与外部可见生成的区别**。很多同学把模型输出的最终文本，当成模型全部计算过程本身。实际上推理请求往往至少包含两部分：一部分是模型内部为了得到答案而进行的计算与表示更新，另一部分才是最终输出到用户侧的文本或结构化结果。到 2025–2026 年，各家厂商都在把 reasoning/thinking 作为正式能力暴露出来：OpenAI 文档区分 reasoning models 与 GPT models，提供 reasoning.effort；Anthropic 在 Claude 4 之后强调 thinking / adaptive thinking；Gemini 文档则提供 thinkingBudget。面试官问推理机制，通常就在试你是否知道：模型的会不会想和想多久是可以作为工程控制量的。

**第二层是logits 到 token的解码过程**。模型前向计算完，并不会直接吐出一句完整答案，而是先给出下一个 token 的概率分布。然后系统再通过 greedy、temperature、top_p、top_k、stop sequence、最大输出长度等机制控制如何从分布里选 token。也就是说，采样参数不是模型知识的来源，而是把已有概率分布转成最终文本的阀门。

**第三层是随机性与正确性的边界**。校招面试里经常会问：把 temperature 调成 0，结果是不是就一定正确？标准答案当然是否定的。低温度只会让模型更偏向高概率 token，并不能把错误知识变成正确知识，也不能弥补缺失上下文、错误工具结果、差的 prompt 或模型本身的能力上限。

**第四层是推理成本意识**。reasoning effort、thinking budget、max tokens、流式输出、工具循环，都直接影响延迟与成本。能把推理质量与 token 成本、首 token 延迟、总时延联系起来的同学，更像真正做过产品，而不是只在 playground 里调过参数。

一个较好的项目表达是：

> 💡 我们没有一上来就靠调 temperature 解决问题，而是先把任务分成‘理解、决策、输出’三段。对于抽取和路由这类确定性较强的步骤，我们降低随机性、加强结构化约束；对于生成候选方案或文案改写，允许更高多样性。复杂报表分析场景里我们还单独提高 reasoning budget，因为这类任务对多步一致性要求更高。最终不是追一个万能参数，而是根据任务阶段做差异化配置。
> 这段话为什么好？因为它体现出三个工程意识：
> 1. 参数是服务于任务阶段的；
> 2. 质量与延迟、成本一起考虑；
> 3. 推理与结构化输出不是同一个环节。

### 二、先把全流程想清楚

![](02_推理机制与采样参数_images/推理机制与采样参数（了解）/N51mbb0qmoQ9oHxvaMbcIAi2nXb.svg)

从工程实现看，一次完整生成通常是循环式的：输入上下文，模型算出 logits，解码器根据采样策略选 token，把新 token 再追加到上下文里，然后继续下一轮。直到命中停止条件，比如生成到终止符、达到最大 token 数、输出完整结构、或者工具调用流程结束。

所以推理这个词在大模型应用里常常混着三层含义：

1. 模型的内部分析能力；
2. 逐 token 生成的解码循环；
3. 在 Agent 中围绕工具、状态、计划展开的更长执行链路。

如果面试官没说清楚，你在回答时可以先主动界定：如果这里说的是模型 inference 的话，我会从 logits 解码和 reasoning budget 两层来讲；如果说的是 Agent 规划推理，那就要加上工具循环和状态管理。这类主动澄清非常加分。

### 三、什么叫推理机制：不要把会思考说得太玄

#### 1. 训练阶段 vs 推理阶段

训练阶段是更新参数，推理阶段是固定参数、给定输入求输出。大模型应用开发里说推理服务推理成本，通常指 inference，而不是 human-like reasoning。很多同学第一次学 LLM 时会被reasoning model这个词带偏，觉得它和 inference 是两回事。其实 reasoning model 还是在做 inference，只不过它被设计成愿意在回答前消耗更多内部计算预算、执行更长的中间分析流程。

#### 2. 显式推理提示、隐式推理预算与最终答案

**传统 prompt engineering 常用 let’s think step by step 这类提示去诱导模型显式输出中间步骤**。现在主流商业模型越来越多地提供内部推理能力，也就是让模型在不完全暴露全部中间过程的情况下，先做更充分分析再输出结果。OpenAI 在 reasoning 文档中强调 reasoning.effort；Anthropic 的 Claude 4 系列在 extended/adaptive thinking 中区分思考预算与输出展示；Gemini 提供 thinkingBudget，并支持动态 thinking。

工程上你要知道这三者的区别：

- 显式推理文本：模型把思路写出来给你看；
- 内部推理预算：模型在内部花更多计算，但不一定完整暴露过程；
- 最终可见答案：真正返回给用户或程序消费的结果。

很多时候产品并不需要完整思维链暴露，只需要更高正确率、更稳结构和更低误答率。面试里如果被问要不要让模型把思考过程全吐出来，更稳的回答是：不一定。需要结合安全、稳定性、用户体验和成本来决定，**很多生产场景更关心 reasoning budget 与最终输出质量，而不是完整中间文本**。

#### 3. 推理增强并不等于万能

更高 reasoning effort 通常有利于复杂数学、代码、多步规划、工具串联这类任务，但不意味着所有任务都该开高档。分类、抽取、简单改写、低风险 FAQ，往往没必要给高推理预算。面试里如果你说所有请求都用最强推理模型，最高 reasoning effort，这基本等于在告诉面试官你没有成本意识。

更成熟的说法是：推理预算是一个可调节的推理时计算资源，适用于高不确定性、高复杂度、多约束一致性任务；对简单、规则明确、对速度敏感的任务则应该下调，甚至路由到非 reasoning 模型或小模型。

### 四、采样参数到底控制了什么

#### 1. Temperature：控制分布平滑程度

temperature 可以理解为放大或压缩概率分布差异的旋钮。温度低时，高概率 token 更容易被选中，输出更集中、更像最保守续写；温度高时，低概率 token 更有机会被选中，输出更发散、更有创造性。

要注意，temperature 作用在采样阶段，而不是改写模型知识。它不会让模型更懂业务，也不会修正事实错误。它主要改变输出多样性与稳定性。

一个非常常见的面试追问是：温度 0 是不是绝对确定？严格说，不同服务端实现、并发环境、浮点数细节、工具调用和后处理链路都可能引入微小差异，所以你不能把temperature=0理解成数学上的绝对确定性，只能理解成非常偏向高概率 token 的近似确定性设置。

#### 2. Top-p：核采样

top-p，也叫 nucleus sampling。做法是先把 token 按概率从高到低排序，然后只保留累计概率达到 p 的最小候选集合，再在这个集合里采样。直觉上，它不是固定保留前 k 个，而是保留足够覆盖主要概率质量的那一撮候选。

top-p 的好处是它会随着分布形态自适应。当概率特别集中的时候，候选集会很小；当概率较分散时，候选集会更大。很多 API 文档都建议：temperature 和 top_p 一般不要同时大改，因为两个都在调随机性，叠加后更难预期。

#### 3. Top-k：固定候选截断

top-k 先只保留概率最高的 k 个 token，再从这 k 个里采样。它的行为比 top-p 更硬：无论分布多么集中，都会只看前 k 个。某些开源推理框架和 Gemini/Vertex 体系会暴露 top-k，但不是所有厂商都把它作为主推荐参数。

面试里如果问 top-k 和 top-p 的区别，你最好回答成固定候选数 vs 固定累计概率质量，而不是简单说都差不多。

#### 4. Max output tokens / stop sequences

这两个参数经常被低估。max output tokens 决定模型最多还能继续生成多长；stop sequences 则用于在命中特定字符串时提前结束。很多结构化输出失败、JSON 截断、工具循环超长、答案啰嗦，本质上都和这两个设置有关。

你在项目里如果遇到模型总是说废话，除了调 prompt，还要第一时间看：

- 最大输出长度是否给太大；
- 是否缺少明确停止条件；
- 是否要求了请详细思考并展开之类会放大冗长的指令；
- 是否在 Agent 循环里没有设置终止阈值。

#### 5. Presence / frequency penalties 等附加参数

不同平台还会提供 presence penalty、frequency penalty 之类参数，用来降低重复、鼓励引入新 token。校招面试一般不会深挖，但你可以知道一个基本原则：这些参数是微调输出风格的辅助项，不是主控项。真正决定结果质量的通常还是模型本身、上下文、任务拆解、推理预算和输出约束。

### 五、为什么参数调优不能替代任务建模

很多人刚做应用时会陷入一个误区：结果不理想，就疯狂改 temperature、top_p、top_k。实际上，大模型结果不好，最常见原因往往不是参数，而是任务建模出了问题。比如：

- 任务太模糊，模型根本不知道目标；
- 上下文缺证据，模型只能猜；
- 工具 schema 不清晰，模型不知道何时调用；
- 输出格式没有约束，模型自由发挥；
- 示例分布和真实任务不一致；
- 模型选型不对，用小模型硬做高复杂度任务。

面试里如果对方问你一般怎么调参数，高质量回答不应该是我先把温度调低。更成熟的流程应该是：

先确认任务是否定义清楚；  
再看模型选型是否匹配；  
再看 prompt/context/工具设计；  
最后才是用 sampling 参数做风格或稳定性微调。

这背后体现的就是工程方法论：先改大杠杆，再改小旋钮。

### 六、Reasoning models 与普通 GPT models：回答方式要变

OpenAI 的 reasoning best practices 文档明确区分 reasoning models 与非 reasoning GPT models。前者更适合多步推理、复杂代码、复杂决策与工具协作，后者通常在低延迟、通用聊天、普通生成任务里更经济。这个区分对面试很重要，因为它会影响你怎么 prompt。

#### 1. 对 reasoning model，不要过度 micromanage

很多强推理模型在设计上已经会进行内部分析。如果你给它过于繁复、过细、甚至相互冲突的步骤指令，反而可能限制它。更稳的做法是把目标、约束、验收标准、可用工具、输出格式讲清楚，把怎么想留给模型自己完成。OpenAI 的新模型提示指导、Anthropic 的 prompt engineering 文档，都越来越强调明确目标和边界，而不是把中间思路写得极其死板。

#### 2. 对小模型和非 reasoning 模型，要更显式

如果是 mini/nano 级别模型，或者本来就不擅长复杂推理的模型，你通常需要：

- 更明确地拆任务；
- 给更直接的格式要求；
- 提供更接近真实分布的 few-shot 示例；
- 避免一个 prompt 里塞太多隐含要求。

这也是为什么面试里经常会问同一个 prompt 在大模型和小模型上要怎么改。标准答案就是：小模型需要更强约束、更少歧义、更短上下文、更直接 schema。

### 七、截至 2026-04 的主流厂商参数差异，你需要知道这些

下面这张表不是为了背数值，而是帮你建立同名参数，不同家族不一定同义且推荐用法不同的意识。

| 厂商/家族 | 当前文档重点 | 你面试里该怎么说 |
|-|-|-|
| OpenAI | 区分 reasoning models 与 GPT models；支持 reasoning.effort；文档建议 temperature 与 top_p 不要同时大改 | 强调模型家族差异，复杂任务优先看 reasoning effort，而不是只盯 temperature |
| Anthropic Claude 4+ | thinking / adaptive thinking；某些新模型上 manual budget_tokens 已逐步被 adaptive/effort 取代 | 强调思考预算是正式能力，并且 thinking 输出不等于全部内部推理 |
| Gemini 2.5/3.x | 提供 thinkingBudget；Gemini 3 文档多次强调 temperature 保持默认 1.0 更稳 | 说明 Gemini 上有时不要机械套用低温更稳的老经验，要遵循当前模型家族建议 |

这一段很适合在面试里展示你会看官方文档，不是死背旧博客。尤其是 Gemini 3 的文档明确强调 temperature 保持 1.0，低于 1.0 反而可能出现 looping 或复杂推理退化，这就是一个典型的旧经验不一定适用于新模型的案例。

### 八、推理质量、延迟与成本是怎么绑在一起的

#### 1. 更高推理预算通常意味着更高成本

推理预算变高，内部 reasoning tokens 或内部计算过程会变多。哪怕你没把中间思路都显示出来，账单和延迟也可能会上升。Anthropic extended thinking 文档明确说明，费用与 thinking tokens 有关；Gemini pricing 也把 thinking token 计入输出价格口径；OpenAI reasoning effort 则直接体现为不同的推理时计算深度。

#### 2. 首 token 延迟和总时延不是一回事

有些请求首 token 很快，但整段输出很长；有些 reasoning 请求首 token 慢，但最终答案更短更准。你在面试里如果能主动区分 TTFT（time to first token）和总完成时长，会显得非常像做过线上系统的人。

#### 3. 参数不是越多越好，预算也不是越高越好

推理预算本质是资源分配问题。面向用户的实时问答、语音交互、简单表单抽取，通常优先低延迟；复杂代码修复、报表分析、规划执行，则可能更愿意牺牲一些延迟换正确率。一个成熟系统的做法一般是路由，而不是全量最高配置。

### 九、高频面试题与参考回答要点

#### 问题 1：temperature 调成 0，模型就不会错了吗？

不会。temperature 只影响采样随机性，不修复错误知识、缺失上下文或错误任务建模。

#### 问题 2：top-p 和 top-k 有什么区别？

top-p 按累计概率质量截断候选集，top-k 按固定候选数量截断。前者更自适应，后者更硬。

#### 问题 3：为什么官方常说 temperature 和 top_p 不要同时改？

因为两者都在控制随机性，同时大改会让行为更难预测和调试。

#### 问题 4：reasoning effort / thinking budget 有什么用？

它控制模型在回答前投入多少推理时计算资源。复杂任务更有价值，简单任务通常不值得高开。

#### 问题 5：为什么低温度不等于高正确率？

因为正确率还取决于模型能力、上下文证据、任务定义、工具结果和输出约束。低温只是更保守。

#### 问题 6：什么时候应该提高 temperature？

在文案生成、发散创意、标题 brainstorming、多个候选方案生成等需要多样性的任务里更有意义。

#### 问题 7：什么时候不建议追求显式思维链输出？

当你只关心最终结构化结果、担心冗长输出、需要更稳产品体验或有安全与泄露风险时，不一定需要完整中间过程。

#### 问题 8：为什么有时同一参数在不同模型上表现差很多？

因为模型家族、默认解码策略、内部 reasoning 机制、训练对齐方式都不同。参数名相同，不代表行为完全一致。

#### 问题 9：项目里一般先调哪些参数？

先不急着调参数，先确认任务定义、上下文、prompt、模型选型和输出约束，再对 temperature / max tokens / stop sequences 做必要微调。

#### 问题 10：为什么模型会重复说车轱辘话？

常见原因包括最大输出太大、缺少停止条件、提示词鼓励展开、模型陷入高概率重复、或任务目标没有收束。

#### 问题 11：推理模型是不是一定比普通模型更强？

不是。它通常在复杂多步任务上更强，但未必适合低延迟、低成本、简单结构化任务。

#### 问题 12：Agent 场景里采样参数怎么设？

要看阶段。规划阶段可能允许适度发散，执行/结构化阶段往往更低随机性、更强 schema 约束。不要所有阶段一个参数打到底。

### 十、常见误区

第一个误区，是把采样参数当成主要优化手段。真正的大杠杆往往是模型、上下文、任务拆解和工具链。

第二个误区，是把更高 reasoning effort理解成更高智能。它更像愿意花更多时间做题，并不保证每题都对。

第三个误区，是用统一参数覆盖所有任务。实际系统往往至少区分：分类/抽取、对话生成、复杂分析、工具执行四类。

第四个误区，是忽视停止条件。很多线上事故不是模型不会，而是模型停不下来、JSON 没收口、工具循环没终止。

### 十一、总结

如果你只记住一句话，那就是：  
**采样参数控制的是怎么从概率分布里拿答案，推理预算控制的是模型在拿答案前愿意花多少计算去想，两者都重要，但都不能替代正确的任务建模。**

**先解决模型选型、上下文证据和输出约束，再去调 temperature/top_p/max_tokens，才是生产上更有效的顺序。**

### 资料来源与延伸阅读

#### 官方文档

1. OpenAI Reasoning Models / Best Practices  
[https://developers.openai.com/api/docs/guides/reasoning/](https://developers.openai.com/api/docs/guides/reasoning/)  
[https://developers.openai.com/api/docs/guides/reasoning-best-practices/](https://developers.openai.com/api/docs/guides/reasoning-best-practices/)
2. OpenAI Responses API Reference（temperature、top_p 等参数）  
[https://developers.openai.com/api/reference/resources/responses/methods/create/](https://developers.openai.com/api/reference/resources/responses/methods/create/)
3. OpenAI 最新模型使用指南（reasoning.effort）  
[https://developers.openai.com/api/docs/guides/latest-model/](https://developers.openai.com/api/docs/guides/latest-model/)
4. Anthropic Extended Thinking  
[https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
5. Anthropic Prompt Engineering Overview  
[https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
6. Gemini Thinking  
[https://ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking)
7. Gemini 3 Developer Guide / Text Generation  
[https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)  
[https://ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)
8. Vertex AI 参数调节文档  
[https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/adjust-parameter-values](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/adjust-parameter-values)

#### 相关资料

1. OpenAI GPT-5 系列 Prompt Guidance  
[https://developers.openai.com/api/docs/guides/prompt-guidance/](https://developers.openai.com/api/docs/guides/prompt-guidance/)
2. OpenAI Latency Optimization  
[https://developers.openai.com/api/docs/guides/latency-optimization/](https://developers.openai.com/api/docs/guides/latency-optimization/)

### 补充 · 大模型参数设置（B 套）

> 来源：购买资料 B（原文第 1083–1161 行）

#### 2 大模型参数设置

（这个知识点其实面试官主动考察的并不多，目前只有平安证券的一面面试官问到了，你有没有对模型做一些参数的调整，怎么设置的penalty， temperature. 目前没有其它面试官问到。所以总体来说，这不是一个特别常考的考点。 从面试角度，可以适当放低学习优先级。另外其实如果你学好了本章，其实在一些和面试官讨论的过程，讨论一些发散性的知识的时候，很常被用到。 比如说夸克千问面试官在和你讨论说：如何避免一些极端情况的输出呀？那这个时候，调整模型参数将会是一个可讨论点。另外从实战角度，其实在你的项目中，去调整参数做适配也挺常用的对吧，从这两个角度，也是可以推荐去学一下的）

##### 2.1 常见参数和选择策略

[嵌入视频](https://open.douyin.com/player/video?vid=7534775858423254306&mode=pc)

LLM 推理参数详解表

![图片是一张表格，展示了LLM推理中常见参数及其含义、作用机制、取值范围和使用建议。参数包括temperature（温度，控制输出随机性）、top_p（核采样，控制候选选的累积概率范围）、max_tokens（最大标记数，限制输出长度）、presence_penalty（存在惩罚，鼓励引入新话题）、frequency_penalty（频率惩罚，减少重复用词）。如temperature取值0 - 2.0，可调整token概率分布的平滑度；top_p取值0 - 1.0，从累积概率达到p的最小token集合中采样；max_tokens取值1 - 模型上限，硬性限制模型输出的token数量上限等。](02_推理机制与采样参数_images/B-B3/OJtUbBewJopfY3xv2rqcktGenBe.png)

常见场景配置推荐

![图片为LLM推理参数详解表，展示了不同场景下参数的推荐值。场景包括分类任务、信息提取、普通对话、长文章生成、创意写作、头脑风暴等。各场景下temperature、top_p、max_tokens、presence_penalty、frequency_penalty参数均有对应数值，如分类任务temperature为0，max_tokens为50等，直观呈现了不同场景的参数配置情况。](02_推理机制与采样参数_images/B-B3/O5EZbji5ZoPtdoxYFBScXstenOd.png)

##### 2.2 Temperature & Top-p

###### 2.2.1 详细原理

（想深入理解这两个参数的原理，请看这个视频）

[嵌入视频](https://open.douyin.com/player/video?vid=7578100067626781979&showTab=like&mode=pc)

在大语言模型生成文本时，通常会用到两个参数：**temperature** 和 **top-p**，它们决定了采样的**随机性**和**多样性**。

首先我说一下大模型生成回答的**大致原理**：

模型先为每个候选 token 计算分数（logits），再通过 softmax 转换成概率分布，然后根据这些概率进行加权采样。

在这个过程中：

**temperature** 会在 **softmax 前调整 logits，温度低时分布更尖锐，模型更确定，输出更保守；温度高时分布更平滑，增加随机性，输出更有创意**。

**top-p** 则通过“核采样”限制采样范围，只在累计概率达到 p 的最小集合中选择 token，p 越小越集中，p 越大越多样。

简单来说，**temperature 控制概率分布的陡峭度，影响确定性；top-p 控制采样范围，平衡质量与多样性，两者结合决定生成结果的稳定性与创造性。**

###### 2.2.2 不同参数组合情况

(进一步补充，以防面试官追问）

**temperature 低 + top-p 小**

- **效果**：输出非常稳定、保守，几乎总是选择概率最高的 token。
- **特点**：答案更确定、更接近训练数据，适合需要精确、严谨的场景（如代码生成、事实问答）。
- **缺点**：缺乏创造性，容易重复。

---

**temperature 高 + top-p 大**

- **效果**：输出非常多样化，随机性强，可能出现意料之外的表达。
- **特点**：适合创意写作、头脑风暴，能生成新颖内容。
- **缺点**：连贯性和逻辑性可能下降，甚至出现不相关或错误内容。

---

**temperature 低 + top-p 大**

- **效果**：整体仍偏稳定，但允许更多候选 token，输出稍微丰富。
- **特点**：在保持连贯的同时，增加一点灵活性，适合对话或内容生成。
- **缺点**：仍然不够有创意。

---

**temperature 高 + top-p 小**

- **效果**：在有限候选集中引入较强随机性，输出有一定变化但不会太离谱。
- **特点**：适合需要一定创造性但又不能完全失控的场景，比如营销文案。
- **缺点**：可能出现轻微逻辑跳跃。

##### 2.3 你的项目是如何设置参数的？

（这个是真实地面试问题了，平安证券1面问的。大家根据答案也想想自己的项目应该如何回答）

我的项目中，总体是一个分析型的任务。核心需求是稳定，准确。总体设置的温度较低，在0.1\~0.3，然后Top_p保持默认，让模型在合理参数内选择，不用太多调整。惩罚因子设置较低的值，因为形成建议可能会多次提到相同的地点，时间。所以惩罚因子设置在0.1左右。

## 3. 上下文窗口与KVCache

### 一、这篇在面试里考什么

问上下文窗口，很多同学张口就是它表示模型一次能处理多少 token。这句话没错，但不够。面试官真正想知道的是：**你是否理解上下文预算会同时决定质量、成本、延迟和系统设计（最爱考的trade-off类问题）**。

**第一，面试官会看你是否区分能放进去和能用得好**。主流商用模型到 2026 年已经普遍支持几十万到百万级上下文，但学术和工业实践都在提醒我们：长窗口能力不等于对长窗口中每一段信息都同等敏感。Lost in the Middle 这类研究说明，把关键信息放在长上下文中间位置时，模型利用效果可能明显下降。也就是说，长上下文是容量问题，长上下文利用率是检索与注意力分配问题，这两者不能混为一谈。

**第二，面试官想看你是否知道推理时最贵的部分之一是什么**。很多人只关心模型参数量，却忽略了序列越长，前缀计算与 KV Cache 占用也越重。特别是在线推理服务里，长上下文不仅提高 token 账单，还会拉高首 token 延迟，压缩并发能力。所以上下文越大越好的说法非常外行。

**第三，这一题常常被用来过渡到缓存与优化**。真正做过系统的同学会知道，长上下文时代最重要的工程技巧之一就是不要重复算同样的前缀。这背后就牵涉 KV Cache、prefix caching、prompt caching、context caching。它们名字像，但层次不同：有的是模型解码时的内部状态缓存，有的是服务端对重复前缀的复用策略，有的是应用层显式把大块上下文缓存成可复用对象。面试官问你这些概念，就是在看你有没有把推理服务、应用接口和成本控制串起来。

**第四，长上下文问题还会自然连到 RAG、memory、context engineering**。因为一旦你真正理解上下文预算有限、注意力分布不均、缓存成本可观，你就会知道为什么不能把整个知识库一股脑塞进 prompt，为什么需要检索、重排、摘要、压缩和按需加载。

你可以这样结合项目描述，让面试官觉得你是对这一块有独立思考的：

> 💡 我们的业务一开始尝试把整篇文档直接塞进模型，但发现首 token 延迟明显上升，而且回答对中间章节引用不稳定。后来我们把系统 prompt、工具定义、产品规则做成稳定前缀，通过 prompt caching 提高命中率；知识内容则走检索与重排，只把高相关片段放进本轮上下文。多轮会话里再把早期历史压缩成结构化 summary/state，避免上下文越聊越脏。这样做后，质量、延迟和成本都更可控。

### 二、先建立一个工程视角的全景图

![](03_上下文窗口与KVCache_images/上下文窗口、KV Cache 与长上下文问题/FQjsbXgkIolldRxsb62cVdhTnfc.svg)

理解长上下文，最关键是区分 prefill 和 decode。

- **Prefill**：模型先把整段已有上下文都读一遍，为每一层生成 K/V 状态。上下文越长，prefill 通常越重，TTFT（首 token 延迟）越高。
- **Decode**：之后每生成一个新 token，只需要基于历史缓存继续算新增部分。这个阶段 KV Cache 会极大降低重复计算。

所以如果面试官问为什么超长 prompt 首 token 慢，你就从 prefill 讲起；如果问为什么 KV Cache 能提速，你就从 decode 阶段避免重复计算讲起。把这两部分分清楚，回答会非常专业。

### 三、什么是上下文窗口，为什么它不是一个单纯的数字

#### 1. 定义：一次请求中模型可处理的总 token 预算

上下文窗口（context window）通常指模型在一次请求中能处理的 token 总预算。这个预算一般同时覆盖输入和输出，某些平台还会受到 reasoning token、工具消息、系统提示等隐性成本影响。很多初学者只记住某模型是 128k/400k/1M，但真正线上做系统时，你要问的是：

- 系统提示词占了多少；
- 历史对话占了多少；
- 检索资料占了多少；
- 工具 schema 和工具结果占了多少；
- 还要给输出预留多少。

也就是说，context window 不是你能塞进去的文档大小，而是整个会话状态的预算上限。

#### 2. Token 预算是系统资源，不是无成本便利

OpenAI、Anthropic、Gemini 等平台都在文档里强调 token 成本；Gemini 与 Anthropic 还分别提供 context/prompt caching 机制，OpenAI 则在新文档里强调 prompt caching 与 compaction。为什么大家都在做这些事？因为长上下文太贵了，而且越来越成为真实应用的主要瓶颈之一。

你在面试里最好能明确指出两个成本：

- **显性成本**：token 计费；
- **隐性成本**：显存占用、并发下降、首 token 延迟增加。

只会说会更贵是不够的，更好的表达是：更长输入不仅提高计费，还增加 prefill 计算与 KV Cache 占用，影响 TTFT 和吞吐，因此长上下文设计一定是质量与性能的平衡问题。

### 四、KV Cache 到底是什么

#### 1. 直觉解释

在自回归生成中，如果每生成一个新 token 都把前面全部上下文从头算一遍，那代价会极大。KV Cache 的核心思想就是：在 previous tokens 已经算过的情况下，把各层 attention 需要的 Key 和 Value 状态缓存起来。下一步只需要为新 token 计算 Query，并与历史的 K/V 交互，就能继续生成。

你可以把它理解成：  
历史读过的书页先做成索引，下次不再整本重读，只增量读新的一页。

#### 2. 为什么它重要

KV Cache 直接决定：

- 解码速度；
- 显存占用；
- 最大并发；
- 可支持的有效上下文长度。

Google 关于 tiered KV cache 的工程文章直接指出，KV Cache 的 GPU 显存占用会成为上下文长度、并发度和总体吞吐的关键瓶颈。Hugging Face 的缓存文档也把动态缓存、静态缓存、量化缓存、offloading 等策略作为生成性能优化的重要主题。也就是说，今天的推理服务优化，很多时候已经不是算力够不够，而是KV Cache 怎么放、怎么复用、怎么迁移的问题。

#### 3. KV Cache 与 Prompt Caching 不是一回事

这是面试非常爱问的点。

- **KV Cache**：通常指单次生成或持续会话中的模型内部状态缓存，主要优化 decode 过程。
- **Prefix / Prompt Caching**：通常指当不同请求共享相同前缀时，服务端或框架复用已算过的前缀结果，避免重复 prefill。
- **Context Caching**：更多是应用层或 API 层对大块上下文的显式缓存引用，例如 Google Gemini/Vertex 的 cache object。

你如果能清楚地区分模型内部状态缓存和跨请求前缀复用，面试官一般会默认你看过推理框架或官方文档。

### 五、Prefix Caching / Prompt Caching / Context Caching的区别

![](03_上下文窗口与KVCache_images/上下文窗口、KV Cache 与长上下文问题/Foi5bB6R4oqKE6x3tcXcNVUSnIh.svg)

#### 1. Prefix Caching

vLLM 文档把 automatic prefix caching 解释得非常直接：如果新请求与历史请求共享同样的前缀，就可以直接复用前缀对应的 KV 块，跳过共享部分的计算。vLLM 甚至明确指出，这种复用已经被很多公有端点和开源推理框架广泛使用，因为它几乎不改变输出，却能显著降延迟。

这对应用开发的启示是：  
如果你的系统 prompt、工具 schema、产品规范、长文档前言高度稳定，就应该尽量把稳定前缀做成可缓存结构，而不是每次重新拼接一大坨略有差异的文本，白白浪费缓存命中率。

#### 2. OpenAI Prompt Caching

OpenAI 文档已把 Prompt Caching 作为正式指南，说明 recent models 会自动启用缓存，并在 pricing 中区分 input 与 cached input 价格。这意味着从产品角度看，提示词工程不再只是怎么写得对，还变成怎么写得能命中缓存。比如频繁改动系统提示词、随机插入无关 metadata、把稳定前缀和用户动态输入混在一起，都可能降低缓存收益。

#### 3. Anthropic Prompt Caching

Anthropic 文档在 2025–2026 年进一步细化了 prompt caching，支持 automatic caching，并明确说明 tools、system、user/assistant content、图像与文档、tool use/result 等大量内容都可以成为缓存对象。这个设计非常适合 Agent：因为 Agent 的系统提示、工具定义、权限说明、项目背景等通常都比较稳定，真正变化的是用户请求和局部上下文。

#### 4. Gemini / Vertex Context Caching

Google Gemini 和 Vertex AI 文档强调 explicit caching：你可以先把一大块文本、音频、视频或文档缓存起来，后续请求引用该缓存对象，并只附加少量本轮输入。它更像把大上下文存成一个可复用资产，适合多轮围绕同一大文档做问答、分析或生成。Gemini 还支持 TTL 概念，说明 cache 不是永久资产，而是受生命周期管理的资源。

### 六、长上下文为什么不一定真的有用

#### 1. Lost in the Middle：中间位置的信息最容易被忽略

《Lost in the Middle》是长上下文讨论里最经典的论文之一。它指出，很多长上下文模型在需要从很长输入中找到关键信息时，效果对位置信息非常敏感：开头和结尾的内容往往更容易被利用，而中间部分可能被显著忽略。这个现象对应用设计的启发非常直接：

- 不要把最关键证据埋在长 prompt 正中间；
- 长文档问答不要只靠整篇塞入，最好结合检索和重排；
- 最重要的信息应该尽量靠前、靠后或被显式标记；
- 单纯扩大窗口不能替代检索质量。

面试里如果问为什么 1M context 还要做 RAG，这就是最标准的回答素材。

#### 2. 上下文污染与注意力稀释

上下文太长会带来另一个问题：噪声变多。无关历史对话、重复片段、失效工具结果、多个版本冲突的业务规则，都可能污染模型判断。很多线上系统不是上下文不够，而是上下文太脏。这时候真正需要的不是更大窗口，而是更好的上下文治理。

#### 3. 长上下文与多轮会话并不等价

有些同学以为模型有百万窗口，就可以无限聊。但多轮会话除了窗口上限，还有状态漂移、历史冲突、旧指令污染、缓存失效、工具结果过时等问题。到 2025–2026 年，OpenAI 的 Responses compaction、Anthropic 的 context management、Gemini Live 的 session summary 等新能力都在说明：长会话要靠摘要、压缩、状态管理，不是简单无限堆历史消息。

### 七、长上下文的常见优化思路

#### 1. 检索优先，而不是全量塞入

如果任务是从几十万字文档中找特定证据，最优策略往往是先检索、再精选片段、再按顺序组织，而不是把整本文件直接塞给模型。大窗口降低了必须极致裁剪的压力，但并没有消灭检索与重排的必要性。

#### 2. 结构化组织比原文堆叠更重要

把上下文分成：

- 任务目标；
- 关键事实；
- 规则约束；
- few-shot 示例；
- 工具列表；
- 候选证据；
- 输出 schema；

通常比把十段文档原文依次贴上去效果更好。这其实已经进入 context engineering 的范畴：不是喂更多，而是喂得更有结构。

#### 3. 显式压缩与会话总结

对于多轮对话，保留全部历史往往既贵又脏。更常见做法是：

- 只保留最近若干轮原文；
- 早期历史压缩成 summary/state；
- 把已完成的步骤用户偏好待办约束提取成结构化状态；
- 必要时做 compaction。

#### 4. 让前缀稳定，提高缓存命中率

这是一条非常工程化、也非常容易在面试中脱颖而出的经验。  
很多系统 prompt、权限说明、工具 schema、产品规则明明是稳定的，却每轮都加时间戳、随机 request id、无意义换行或顺序扰动，导致 prompt cache 很难命中。  
真正懂系统的人会主动把稳定前缀和动态后缀拆开设计。

### 八、高频面试题与答题要点

#### 问题 1：什么是 context window？

一次请求里模型可处理的总 token 预算，通常覆盖输入与输出，也会受到系统提示、工具消息、历史对话等共同占用。

#### 问题 2：上下文窗口越大越好吗？

不一定。更大窗口意味着更高成本、更高首 token 延迟、更大缓存压力，而且模型对长上下文的利用率未必线性提升。

#### 问题 3：为什么长 prompt 首 token 会慢？

因为 prefill 需要先对整段前缀做计算并生成各层缓存，上下文越长，prefill 通常越慢。

#### 问题 4：KV Cache 是什么？

是自回归生成时缓存历史 token 的 Key/Value 状态，避免每一步都从头计算历史上下文。

#### 问题 5：KV Cache 和 prompt cache 有什么区别？

KV Cache 更偏单次生成内部状态；prompt/prefix cache 更偏跨请求前缀复用；context cache 则常是 API 层显式缓存大块输入。

#### 问题 6：为什么有了 1M context 还要做 RAG？

因为长上下文并不保证高效利用，关键证据可能被埋没；而 RAG 能减少噪声、提升证据密度、降低成本。

#### 问题 7：Lost in the Middle 说明了什么？

说明模型对长上下文中不同位置的信息利用并不均衡，中间位置的关键信息更可能被忽略。

#### 问题 8：为什么缓存能降成本？

因为重复前缀不必重新 prefill，既减少计算也减少部分输入计费，并改善延迟。

#### 问题 9：长会话为什么需要 compaction / summary？

因为无限保留原始历史会带来窗口占用、噪声累积、旧状态污染和成本上升。

#### 问题 10：项目里如何提高缓存命中率？

稳定 system prompt 和工具 schema，减少无意义动态字段，把固定前缀与用户动态输入分离。

### 十、常见误区

第一个误区，是把上下文窗口当成模型记忆力指标。窗口只是可处理容量，不等于稳定记忆与长期状态。

第二个误区，是把 KV Cache 说成把之前答案缓存住。其实它缓存的是中间 attention 所需状态，不是自然语言文本本身。

第三个误区，是认为 prompt 越长越充分。实际上很多任务在关键信息密度更高、噪声更低时效果更好。

第四个误区，是只看 token 费用，不看并发与显存。真正线上服务常常先被 KV Cache 和 TTFT 拖垮，而不是先被账单拖垮。

### 十一、截至 2026-04 的现代趋势

截至 2026 年，长上下文已经从模型参数表上的卖点变成应用系统的常规约束。OpenAI 模型页面已经把数十万到百万级 context window 作为新一代模型的常见能力，并提供 prompt caching 与 compaction 相关能力；Anthropic 不仅提供 prompt caching，还在模型能力描述里暴露 context management/compact 支持；Google Gemini 则同时把 long context、thinking、structured outputs、function calling、context caching 放进第一层开发文档中。行业在告诉你一件事：  
**大窗口不是终点，围绕大窗口做状态治理、缓存复用、按需加载与压缩，才是现代 LLM/Agent 系统的日常。**

### 十二、你应该记住的结论

如果这篇只记一句话，那就是：  
**长上下文解决的是放得下，而检索、重排、压缩、缓存解决的是用得好、用得省、用得快。**

再补一句：  
**KV Cache 解决单次生成的重复计算，prompt/context caching 解决跨请求共享前缀的重复 prefill，它们是长上下文时代的核心工程武器。**

### 资料来源与延伸阅读

#### 官方与框架文档

1. OpenAI Models / Prompt Caching / Pricing / Changelog  
[https://developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models)  
[https://developers.openai.com/api/docs/guides/prompt-caching/](https://developers.openai.com/api/docs/guides/prompt-caching/)  
[https://developers.openai.com/api/docs/pricing/](https://developers.openai.com/api/docs/pricing/)  
[https://developers.openai.com/api/docs/changelog/](https://developers.openai.com/api/docs/changelog/)
2. Anthropic Prompt Caching / Models Overview / List Models  
[https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)  
[https://docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)  
[https://docs.anthropic.com/en/api/models-list](https://docs.anthropic.com/en/api/models-list)
3. Gemini Long Context / Context Caching / Models / Changelog  
[https://ai.google.dev/gemini-api/docs/long-context](https://ai.google.dev/gemini-api/docs/long-context)  
[https://ai.google.dev/gemini-api/docs/caching](https://ai.google.dev/gemini-api/docs/caching)  
[https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)  
[https://ai.google.dev/gemini-api/docs/changelog](https://ai.google.dev/gemini-api/docs/changelog)
4. Vertex AI Context Cache  
[https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview)
5. vLLM Automatic Prefix Caching  
[https://docs.vllm.ai/en/latest/design/prefix_caching/](https://docs.vllm.ai/en/latest/design/prefix_caching/)
6. Hugging Face KV Cache / Cache Strategies  
[https://huggingface.co/docs/transformers/en/kv_cache](https://huggingface.co/docs/transformers/en/kv_cache)

#### 论文

1. Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*  
[https://arxiv.org/abs/2307.03172](https://arxiv.org/abs/2307.03172)
2. Google Cloud: Tiered KV Cache 工程文章  
[https://cloud.google.com/blog/topics/developers-practitioners/boosting-llm-performance-with-tiered-kv-cache-on-google-kubernetes-engine](https://cloud.google.com/blog/topics/developers-practitioners/boosting-llm-performance-with-tiered-kv-cache-on-google-kubernetes-engine)

## 4. 幻觉与对齐

### 一、幻觉就是面试官实际用模型遇到的烦恼

“幻觉”“对齐”“指令跟随”这三个词经常一起出现，但很多同学只会把它们当成安全八股去背。实际上，这一组问题在面试里经常用来区分“会用模型”和“理解模型边界”的人。

第一，面试官在看你是否知道：LLM 的目标函数从来不是“说真话”，而是“生成高概率的下一个 token”。只要你把这个根因讲明白，后面很多问题都会顺：为什么模型会编造来源、为什么缺证据时仍可能自信回答、为什么流畅性和真实性不是同一个维度。很多回答失败，就是因为上来把幻觉说成“训练数据不够”，这只说中了部分原因。

第二，面试官在看你对 alignment 的理解是不是停留在“让模型更安全”。更完整的定义应该是：对齐是让模型更符合人类或产品期望的过程，包含 helpfulness、harmlessness、honesty、instruction following、格式稳定性、工具使用边界等多个方面。换句话说，对齐不只是拒绝危险请求，也包括更好地遵循系统角色、遵守业务规则、承认不确定性。

第三，面试官会用这组题考你有没有产品视角。实际应用里，用户经常把“模型没答对”统称为幻觉，但工程上你必须区分：

- 真正的 factual hallucination；
- 上下文中明明有证据却没用好；
- 工具返回错了；
- 检索召回错了；
- 指令冲突导致模型选择了错误目标；
- 模型输出格式不符合要求；
- 模型其实不确定，但被 prompt 逼着必须回答。  
如果你分不清这些故障类型，后面就谈不上治理。

第四，这一题还常被用来引出安全与 Agent。Agent 一旦能调工具、发请求、执行操作，指令跟随能力越强，潜在副作用也越大；而如果 alignment 不够好，模型可能在被 prompt injection 或上下文污染后执行错误动作。所以这部分不只是“答得像论文”，而是后续系统设计与治理的基础。

对于这一章涉及到的问题，一个较成熟的项目表述是，展示了“故障分类 + 分层治理 + 可观测”三个真实工程能力：

> 💡 “我们把线上错答分成四类：事实性幻觉、检索失配、工具误用、格式不一致，而不是一股脑都叫 hallucination。治理上先改任务定义，允许模型在无证据时返回 cannot_answer；再把关键证据抽成结构化片段而不是整段原文拼接；对高风险问题增加搜索或数据库校验；同时在输出 schema 里加 evidence_ids 和 uncertainty_note。这样做后，模型并不是‘不再犯错’，而是更少在没证据时硬编，错误也更容易被发现和拦截。”

### 二、怎么区分这三者

![](04_幻觉与对齐_images/幻觉、对齐与指令跟随/BqMfbN5Choq9fSxZm5acqF3ynBf.svg)

#### 1. 幻觉是什么

严格说，幻觉（hallucination）指模型生成了流畅但不真实、无依据、与给定上下文不一致、或无法被外部证据支持的内容。它既可能是事实性错误，也可能是引用、出处、数字、代码 API、推理步骤、工具执行结果上的编造。

#### 2. 对齐是什么

对齐（alignment）是让模型行为更符合人类意图与系统要求的过程。它的目标通常不止一个维度，常见包括：

- helpful：有帮助；
- harmless：降低伤害；
- honest / truthful：尽量承认不确定性，不乱编；
- steerable：能稳定遵守角色与系统指令；
- reliable：格式、工具调用、边界控制更稳。

#### 3. 指令跟随是什么

指令跟随（instruction following）是 alignment 中一个非常核心的子能力，指模型能不能正确理解并执行来自 system/developer/user 层的要求。它包括：

- 明确目标；
- 遵守优先级；
- 不被低优先级内容轻易带偏；
- 在冲突时做合理取舍；
- 能按照给定格式输出；
- 在信息不足时适当表达不确定，而不是瞎补。

这三个概念的关系不是“并列概念”，而是：  
**对齐是总框架，指令跟随是对齐的一部分，幻觉是模型在真实性/证据一致性上暴露出来的一类失败模式。**

### 三、为什么模型会幻觉：根因一定要答到底层

#### 1. 目标函数不是事实核验器

LLM 在预训练阶段学的是语言分布，而不是“真实世界校验规则”。它的本能是生成“看起来合理、接得下去”的 token 序列。于是当上下文缺证据、问题又逼着它必须给答案时，它非常容易走向高流畅度、低真实性的输出。这是最根的原因。

#### 2. 训练数据本身就有噪声、过时与冲突

语料中包含错误信息、过时知识、不同立场、不同版本 API、不同时间点的事实。模型把这些都压缩进参数后，不会自动形成完全一致的真值库。于是你问一个细粒度事实、冷门版本问题、时间敏感问题时，它很可能混用旧知识与近似模式。

#### 3. 上下文证据不足或上下文组织不当

很多所谓“模型幻觉”，其实根本原因是我们没给它足够证据，或把证据塞得太乱。比如：

- 检索召回错了文档；
- 关键信息埋在长上下文中间；
- 多个版本的业务规则同时出现；
- 系统提示要求必须回答，禁止说“不确定”。  
这种情况下，模型“编”出来的内容，某种意义上是系统设计在逼它编。

#### 4. 解码随机性与长链误差积累

采样参数越发散，模型选择低概率 token 的机会越高；多步生成越长，局部小错越可能滚成整体大错。特别是长文本、复杂 SQL、长代码、工具串联计划，一步偏了，后面都跟着漂移。

#### 5. 工具、检索和外部系统引入的新幻觉

到了 Agent 时代，幻觉不再只是“模型脑补”。还包括：

- 模型错误理解了工具返回；
- 工具本身返回脏数据；
- 模型声称工具执行成功，实际上并没有；
- 模型把未发生的外部动作说成已完成。  
Anthropic 在发布 Sonnet 4.6 时特别提到“fewer false claims of success”，这正说明在 Agent/代码场景里，“虚报完成”已经成为一种非常实际的幻觉类型。

### 四、对齐为什么重要：不是锦上添花，而是可用性的基础

#### 1. InstructGPT 给行业建立了一个分水岭

OpenAI 的 InstructGPT 工作一个非常重要的结论是：更大的 base model 不自动意味着更符合用户意图。一个较小但经过人类反馈对齐的模型，可能在人类偏好上优于更大的纯预训练模型。这个认识直接改变了行业路线：从“只追预训练规模”转向“预训练 + 后训练 + 偏好优化”的范式。

#### 2. 对齐不仅是安全，也包括“可控”

从产品角度看，一个不对齐的强模型可能有很多能力，但不一定“好用”。比如：

- 不按格式输出；
- 听不懂系统角色；
- 拒绝边界混乱；
- 明明没证据还硬答；
- 不会承认不知道；
- 工具调错却继续装作没问题。  
这些都是对齐不足，不只是“安全问题”。

#### 3. RLHF、DPO、RLAIF、Constitutional AI 等都是手段，不是目的

你在面试里不一定要把所有后训练算法都展开，但至少知道方向：

- **SFT**：先让模型学会像样地完成指令；
- **RLHF / 偏好优化**：让模型更接近人类偏好；
- **Constitutional AI / RLAIF**：用规则与 AI 反馈帮助塑造更可控行为；
- **规则规格 / Model Spec**：在产品层面明确优先级、边界与行为准则。

回答时最好不要把算法名念成口号，而是直接落到效果：“这些方法共同目标是让模型更 helpful、更稳定、更能遵守边界，并在不确定时更诚实。”

### 五、指令跟随：为什么它越强越需要优先级管理

#### 1. 指令不是一层，而是多层

真实系统里的指令来源通常至少包括：

- 平台/模型层原则；
- system/developer 指令；
- 用户指令；
- 外部工具或检索内容；
- 历史对话中的旧约束。

这些指令可能冲突。如果模型没有优先级意识，就会被低优先级文本带偏。OpenAI 近年的 Model Spec 和相关工作一直强调 instruction hierarchy / chain of command，这本质上是在解决“听谁的”问题，而不是“能不能听见”问题。

#### 2. 强指令跟随并不自动提升真实性

这是个很容易被忽视的点。模型如果非常听话，而你的提示词写着“给我一个明确答案，不要说不确定”，那它可能更积极地编。也就是说，指令跟随能力越强，越需要你把“何时承认不知道、何时要求证据、何时调用工具验证”写进系统规则。

#### 3. Agent 里更要控制 side effects

在普通问答里，错答是认知错误；在 Agent 里，错答可能变成错误操作。于是 instruction following 必须和权限、审批、可回滚、幂等、安全策略一起设计。否则强执行力会变成强风险。

### 六、怎么降低幻觉：面试要讲方法分层

#### 第一层：任务定义层

最常见也最被忽略。  
如果任务允许“不知道”，就明确允许；  
如果需要证据，就要求“先找证据再回答”；  
如果必须引用来源，就把 citation/evidence slot 放进输出 schema；  
如果问题时间敏感，就要求调用搜索或检索。

你要让模型知道：没有证据时承认不确定，是被允许甚至被鼓励的。

#### 第二层：上下文与检索层

降低幻觉最有效的方法之一，往往不是“改模型”，而是给更好的证据。包括：

- 提升检索召回与重排质量；
- 减少上下文噪声；
- 把关键证据放在更显著位置；
- 用结构化字段而不是大段原文堆叠；
- 对版本号、日期、实体名做显式突出。

Anthropic 的 reduce hallucinations 文档也强调让模型先提取证据、再作答的模式，这类“evidence-first”策略在长文档问答中很有用。

#### 第三层：输出约束层

结构化输出并不会自动提高真实性，但可以强迫模型把“答案”和“依据”拆开。一个简单但很有效的 schema 设计是：

- answer；
- confidence / uncertainty note；
- evidence_ids；
- cannot_answer_reason。

当模型必须显式写出依据来源时，至少更容易被程序和评测发现它在编。

#### 第四层：工具验证层

对时间敏感、事实敏感、高风险任务，不能只靠参数知识。应该：

- 调搜索；
- 查数据库；
- 走代码执行；
- 做二次校验；
- 必要时让 verifier model 或 rule engine 复核。

你在面试里如果能说“降低幻觉不是靠一个更聪明的模型，而是靠证据、验证和工作流设计”，会非常加分。

#### 第五层：后评测与观测层

真正生产中，幻觉治理离不开数据闭环：

- 哪些问题类型最容易编；
- 哪些来源最不可靠；
- 哪些 prompt 促使模型过度自信；
- 哪些工具经常被误用；
- 哪些版本升级后出现回归。

也就是说，幻觉不是一次性解决，而是持续监控与回归测试对象。

### 七、Truthfulness 与 Helpfulness 的张力

很多校招面试会问一个很好的开放题：“为什么有的模型越 helpful，越容易编？”  
这个问题的关键就在于张力。用户通常喜欢明确、流畅、完整的回答，但真实世界里很多问题本来就不确定、缺证据、有时间敏感性。模型如果一味追求“每个问题都给出像样答案”，就更容易输出似是而非的内容；如果一味保守，又会显得 evasive，体验很差。

Constitutional AI 相关工作的重要意义就在于，它尝试在 helpful 与 harmless 之间找到更好的平衡，同时减少那种“什么都拒绝”的无效安全。生产系统里也一样：好的 alignment 不是让模型只会拒绝，而是在该答时有证据地答，在该停时能停，在不确定时明确说不确定。

### 八、目前的前沿视角（截止至2026-04）

#### 1. 厂商越来越把“诚实边界”做成产品能力

OpenAI 的 Model Spec 把 instruction hierarchy、underspecified instructions、agentic side effects 等问题上升为正式规范；Anthropic 的文档明确把 reduce hallucinations、mitigate jailbreaks、reduce prompt leak 放进 guardrails 体系；Sonnet 4.6 的发布说明中直接强调更少的 hallucinations 和 false claims of success；Google 的结构化输出、函数调用、long context 与 thinking 文档则不断把“证据、控制和可预测性”推到前台。行业已经不再满足于“模型更聪明”，而是要求它“更可控、更不乱说、更少瞎完成任务”。

#### 2. 对齐正在从训练问题变成系统问题

以前大家把 alignment 主要看成模型训练问题；现在越来越明显，它同时也是系统设计问题。你怎么写 system prompt，怎么组织 context，怎么设计 tool schema，怎么定义失败时回退，怎么做审批和可观测，都会影响最终的“对齐感”。

所以面试里更高阶的回答，不会只停在 RLHF/DPO，而会主动补一句：“在应用侧，我们也要通过 prompt、context、tools、evaluation、guardrails 共同实现 alignment。”

### 九、高频面试题与答题要点

#### 问题 1：什么是幻觉？

模型生成了缺乏证据支持、与事实或给定上下文不一致、但表面流畅合理的内容。

#### 问题 2：幻觉的根因是什么？

最底层是训练目标不是事实核验，而是 next-token prediction；再叠加数据噪声、证据不足、任务约束不清、解码随机性和系统外部错误。

#### 问题 3：对齐为什么重要？

因为大模型不只是要“会”，还要“好用、可控、守边界、按格式、在不确定时诚实”。对齐提升的是可用性与可控性。

#### 问题 4：指令跟随越强越好吗？

不绝对。强指令跟随需要正确的优先级和边界设计，否则可能更积极地执行错误或有害指令。

#### 问题 5：为什么说“不要乱编”本身也是一种 prompt 设计？

因为你需要明确允许模型承认不知道，并把缺证据时的行为定义为合法输出，而不是逼它强答。

#### 问题 6：如何降低幻觉？

从任务定义、证据检索、上下文组织、结构化输出、工具验证、评测监控六个层面共同治理，而不是只换模型。

#### 问题 7：模型引用了来源就一定没幻觉吗？

不一定。它可能编造来源、错引段落、误解证据。引用只是辅助约束，不是事实保证。

#### 问题 8：Agent 场景里的幻觉有什么新表现？

包括虚报任务完成、误报工具执行成功、误解工具返回、把计划当结果、把模拟输出当真实外部状态。

#### 问题 9：为什么说 alignment 不只是安全问题？

因为格式稳定性、指令优先级、工具边界、诚实表达不确定性、对用户意图的可控遵循，都是 alignment。

#### 问题 10：什么时候应该让模型拒绝回答？

当问题高风险、缺乏可靠证据、请求越权或有明显安全边界冲突时。拒绝本身也要设计成 informative refusal，而不是机械回避。

### 十、项目表达模板

### 十一、常见误区

第一个误区，是把所有错误都叫幻觉。其实检索错、工具错、路由错、格式错、指令冲突都需要分开治理。

第二个误区，是以为更强指令跟随天然会减少幻觉。错误目标下的强执行，反而可能放大幻觉。

第三个误区，是把 alignment 等同于“安全拒绝”。对齐同样包括 helpfulness、格式稳定、边界控制与诚实表达不确定性。

第四个误区，是只靠 prompt 解决所有幻觉。真正高风险任务必须引入外部证据和验证闭环。

### 十二、你应该记住的结论

如果只记一句话：  
**幻觉不是模型“坏习惯”，而是 next-token 目标、数据噪声、证据不足和系统设计共同作用下的自然结果。**

再记一句：  
**alignment 不只是让模型更安全，更是让模型更像一个可控、诚实、能遵守优先级的系统组件。**

### 资料来源与延伸阅读

#### 论文

1. Ouyang et al., *Training language models to follow instructions with human feedback*  
[https://arxiv.org/abs/2203.02155](https://arxiv.org/abs/2203.02155)
2. Bai et al., *Constitutional AI: Harmlessness from AI Feedback*  
[https://arxiv.org/abs/2212.08073](https://arxiv.org/abs/2212.08073)
3. Lin et al., *TruthfulQA*  
[https://arxiv.org/abs/2109.07958](https://arxiv.org/abs/2109.07958)
4. Huang et al., *A Survey on Hallucination in Large Language Models*  
[https://arxiv.org/abs/2311.05232](https://arxiv.org/abs/2311.05232)

#### 官方文档与说明

1. OpenAI Model Spec  
[https://model-spec.openai.com/](https://model-spec.openai.com/)
2. OpenAI 关于 Model Spec 的说明  
[https://openai.com/index/our-approach-to-the-model-spec/](https://openai.com/index/our-approach-to-the-model-spec/)
3. Anthropic Reduce Hallucinations  
[https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
4. Anthropic Sonnet 4.6 发布说明  
[https://www.anthropic.com/news/claude-sonnet-4-6](https://www.anthropic.com/news/claude-sonnet-4-6)
5. Anthropic Models / Guardrails 文档  
[https://docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)
6. Gemini Structured Outputs / Function Calling（用于证据化与约束化输出）  
[https://ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output)  
[https://ai.google.dev/gemini-api/docs/function-calling](https://ai.google.dev/gemini-api/docs/function-calling)

### 补充 · 大模型幻觉（B 套）

> 来源：购买资料 B（原文第 1161–1307 行）

#### **3 大模型幻觉**

> 幻觉问题，其实就是本质是什么，产生的原因是什么，如何解决，我力争把产生的原因写得完整，另外我也加入了一个高级进阶的内容，加了一个清华大学的论文，相当于一个亮点，你回答的时候，答出来会特别新颖。

##### **3.1 大模型幻觉的本质**

幻觉的本质不是模型被显式要求去编造，而是**训练方式和训练数据共同塑造出的一种生成倾向**：当模型面对不确定问题时，它不会天然停下来，而是继续生成一个概率上最像答案的文本。

大模型底层是一个**概率预测器**，不是知识库。它内部没有"事实文件柜"，只有一张词与词之间的概率地图。生成一句话 = 沿着最可能的路径一步一步往下走。所以它从设计上就**没有"真/假"概念**，只有"像不像下一句该说的话"。

所以，大模型不是原生的事实验证系统，而是文本生成系统。它的幻觉不是来自"故意撒谎"，而是来自**下一个 token 预测的训练方式、训练语料中的问答分布，以及后训练阶段对有用性和流畅性的偏好**。

---

##### **3.2 产生的原因**

幻觉的成因可以拆成一条因果链：**根因 → 燃料 → 扳机 → 电路**。这四层不是并列关系，而是层层推进：底层机制决定它会生成，数据缺陷决定它容易走错，训练偏好决定它不愿停下，最后这些倾向会在神经元层面形成可观测的行为电路。

**（1）根因：底层机制决定它是概率预测器，不是知识库**

- 没有事实数据库，只有词与词的概率地图。
- 生成回答 = 一步一步走最可能的路径。
- 错误会随长度累积："出发偏一寸，到终点差千里"。

\- 所以**只要它开口，就有可能编**。这一层解释的是：大模型为什么天然不是事实验证系统，而是文本生成系统。

**（2）燃料：训练数据让它学到的世界本身就是残缺、扭曲的**

\- **训练截止日期**：截止日之后的事实，地图上根本没有路径。

\- **数据稀缺 / 分布不均**：冷门知识只出现几次，路径模糊。

\- **数据污染**：互联网中包含错误信息、阴谋论、甚至被故意"数据投毒"的内容。

\- **过拟合**：模型死记硬背片段，遇到稍变的问题就乱拼。

这些数据就像模型生成时使用的"地图"。地图本身有空白、有错路、有污染，模型自然会在低置信度场景下走偏。但**地图有洞并不必然导致幻觉**——只要模型肯停下来，说"这里没有足够信息"就行。问题在于，第三层让它更倾向于继续说。

**（3）扳机：训练方式与后训练偏好让它从"顺着说"走向"尽量给答案"**

\- **预训练**：没有"讨好用户"的显式目标，只是在海量语料中学习"给定前文，预测下一个 token"。但人类语料里"被问→给答"的模式占绝对多数，模型因此学到"顺着上文继续说"的生成惯性。

\- **后训练（SFT / RLHF / DPO）**：人类偏好数据通常更喜欢清楚、完整、有帮助的回答，而不是频繁的"我不知道"。这会进一步强化模型"尽量给出一个可用答案"的倾向。

\- **结果**：模型不是被显式训练去撒谎，而是在训练方式、数据分布和后训练偏好的共同作用下，形成了"不确定也继续生成答案形式文本"的倾向。

这一层就是幻觉真正被触发的地方：当模型遇到不知道、不确定、信息不足的问题时，它不是天然选择停止，而是被生成惯性和后训练偏好推着继续给出答案形式的文本。到这一步，幻觉已经不是单纯的工程 bug，而是**生成式训练范式自然带来的副作用**。

**（4）电路：H-Neurons 承载了"过度顺从"的生成倾向**

清华大学的论文从神经元层面验证了上面这条因果链：

\- 在模型几十亿参数中，只有**极少数神经元（不到十万分之一）**与幻觉相关，被命名为 **H-Neurons**。

- 扰动实验证明：放大 H-Neurons → 模型接受错误前提、改口附和用户、甚至越狱配合违规请求。

\- 关键发现：H-Neurons 驱动的**不是"错误记忆"，而是"过度顺从"** 这种行为本身。

也就是说，前三层解释了幻觉为什么会产生，H-Neurons 则说明这种倾向在模型内部已经有了可观测的物理载体。更致命的是：这条电路和"说话流畅"的能力**深度纠缠**，无法简单删除——切掉它，模型也不会说话了。这也是为什么幻觉**无法 100% 消除**，目前业界更多是通过工程手段缓解，而不是彻底根治。

---

##### **3.3 解决方案**

既然每一层都无法被彻底"修好"，工程上的策略就是**绕过去、监测它、约束它、复核它**。常见思路包括 RAG、RLHF/DPO、CoT/Self-Ask、多模型投票、外部工具、用户侧验证，以及 H-Neurons 监测。整体可以分成几类：

**（1）外部工具 / Web Search / API / 数据库 —— 让模型不要只靠参数回答**

当问题涉及最新信息、实时数据或企业私有数据时，不应该让模型完全依赖训练参数，而是让它调用**外部工具**，比如 Web Search、搜索引擎、第三方 API、数据库、MCP 工具等。这样模型从"凭记忆生成"变成"先查证再生成"，直接缓解训练截止日期和知识边界问题。

**（2）RAG—— 把回答锚定到可信知识库**

RAG 是外部工具体系里最重要的一类。它把 Agent 的回答和**企业知识库 / 文档库 / 向量数据库 / 搜索引擎**结合，先检索相关资料，再基于检索结果生成回答。它的核心价值是：让模型不要独自承担事实真实性，而是把答案锚定到可追溯的数据来源上。这是工业界最主流、性价比最高的幻觉缓解方案。

**（3）RLHF / DPO 人类反馈微调 —— 重写它的后训练偏好**

用人类标注反馈训练模型，**显式奖励"承认低置信度"** 的行为，让模型在没把握时使用预设回答，而不是编造事实。本质是从训练激励层面修正"必须给答案"的倾向。

**（4）提示词技巧：多轮验证 + 反思（CoT / Self-Ask）**

通过 **Chain-of-Thought + Self-Ask** 等模式，让 LLM 在推理时**分配更多计算资源**（更多步骤、更多思考时间），强迫它把过程展开、自我核查。通常能显著提升准确性、连贯性和稳健性。

**（5）融合模型 / 投票机制 —— 用冗余对抗单模型偏差**

让多个模型或多个 Agent 协同工作，通过投票或加权得出最终答案，降低单一模型幻觉的影响。本质是用"群体智慧"稀释个体的讨好倾向。

**（6）事实核查与用户侧验证 —— 不把模型输出直接当事实**

用户侧防范：对模型给出的日期、统计、引用、法律案例、医学建议等高风险信息，要主动验证。可以检查原始来源、搜索精确引用、换一种问法追问、要求模型给出依据，并警惕"过于完美"或"异常具体但没有来源"的答案。这个方法不是从模型内部消除幻觉，而是在使用环节建立事实校验机制。

**（7）（亮点）H-Neurons 幻觉探测器 —— 监测而不是直接删除**

基于清华论文的发现，理论上可以并行监测 H-Neurons 的实时激活，一旦发现异常飙升，就给出"该答案可能在编"的信号，提示用户或下游 Agent 复核。需要注意的是，论文并不是说可以直接删除 H-Neurons 来彻底解决幻觉，因为这些神经元和模型的语言流畅性深度纠缠。更现实的方向是**监测、抑制、预警**，而不是粗暴切除。

---

###### **3.3.1 附录：H-Neurons 论文概括**

> 既然提到了论文，防止面试官深入问论文的事，我总结了这个论文概括。其实不用看本身，这是搞研究的人要弄的。我们大概理解一下就行。

这篇论文的核心问题是：大模型为什么会在不知道答案时仍然自信地编造？研究者没有只从训练数据、提示词或模型规模这些外部因素解释，而是尝试从模型内部的神经元活动入手，寻找和幻觉行为相关的可观测结构。

论文提出了 **H-Neurons** 这个概念，指一小部分与幻觉行为高度相关的神经元。研究发现，这些神经元并不是简单存储了错误知识，而更像是承载了一种"过度顺从"的行为倾向：当用户的问题带有错误前提、上下文存在误导，或者用户反复质疑模型时，模型更容易顺着用户继续说，而不是纠正问题或承认不确定。

更重要的是，实验表明：增强这些 H-Neurons 的影响，模型会更容易接受错误前提、附和用户、生成错误答案；抑制它们，则可以减少这类过度顺从行为。但论文也指出，不能把这些神经元简单删除，因为它们和模型生成自然、流畅、有帮助回答的能力是纠缠在一起的。也就是说，幻觉不是一个可以被单点切除的独立 bug，而是和大模型的语言生成能力共享部分底层机制。

这篇论文的启发是：未来减少幻觉，除了 RAG、工具调用、事实核查这些工程方法，也可以探索模型内部的实时监测机制。例如在生成过程中观察 H-Neurons 是否异常激活，如果风险升高，就触发复核、检索或拒答策略。它提供的是一种前沿研究方向：**监测和约束幻觉电路，而不是幻想把幻觉彻底删除**。

---

##### **3.4 面试问题照答版**

**Q1：什么是大模型幻觉？它是如何产生的？**

大模型幻觉指的是模型自信地输出**不符合事实**的内容。它的本质不是模型被显式训练去编造，而是底层机制、训练数据分布和后训练偏好共同作用的结果。

第一，大模型底层是一个**概率预测器**，并不真正理解事实，只是根据上下文预测最可能生成的单词序列。

第二，当遇到训练数据没覆盖、或者覆盖很少的低置信度场景时，模型仍然会按照"顺着上下文继续说"的生成惯性，输出一个看起来合理的答案。

第三，后训练阶段（SFT / RLHF / DPO）的人类偏好通常更喜欢清楚、完整、有帮助的回答，这会进一步强化模型"尽量给出一个可用答案"的倾向。

所以，幻觉不是单一原因导致的，而是大模型的生成机制、数据缺陷和后训练偏好共同造成的。

**Q2：如何减少大模型 / Agent 的幻觉？**

工程上主要有几类做法。

第一，接入 **Web Search、搜索引擎、第三方 API、数据库、MCP 工具** 等外部工具，让模型不要只靠参数回答。

第二，使用 **RAG**，将 Agent 回答和外部知识库或向量数据库结合，确保生成内容有真实依据。

第三，使用 **RLHF / DPO 人类反馈微调**，显式奖励模型在低置信度场景下使用预设回答，而不是编造事实。

第四，使用 **Chain-of-Thought + Self-Ask** 等提示词技巧，让模型在推理过程中分配更多计算资源、进行多轮验证和反思。

第五，使用 **融合模型或投票机制**，通过多个模型或 Agent 协同降低单一模型幻觉的影响。

第六，在使用侧建立事实核查机制，对日期、引用、统计、法律和医学等高风险内容进行二次验证。

第七，我也看了最近清华大学的一篇论文，它从模型结构层面分析了幻觉问题。论文认为，模型中有一小部分神经元和幻觉行为高度相关，被称为 **H-Neurons**。但这些神经元和模型"说话流畅"的能力共用同一套电路，不能简单直接切除。更现实的做法是，在使用模型的时候监测每一次 H-Neurons 的激活值，一旦发现异常升高，就进行实时预警，提示系统触发复核、检索或人工确认。

最后总结一下，现阶段大模型幻觉是无法被 100% 消除的。我们能做的是通过外部工具、RAG、反馈微调、推理反思、多模型协同、事实核查和 H-Neurons 监测来**缓解幻觉，而不是彻底根治幻觉**。

---

## 5. 模型选型与路由

### 一、模型选择的理解反映了你的技术敏感度

过去几年，大模型面试里常见问题是你用过哪些模型。到 2025–2026 年，这个问题已经明显升级成了你怎么选模型、怎么做模型路由、为什么不是所有请求都上最强模型。这背后反映的是行业成熟：模型越来越多、能力越来越分层、价格差距越来越大、接口越来越统一，真正重要的已经不是知道有哪些模型，而是知道如何做系统级决策。

**第一，面试官会看你有没有摆脱排行榜思维。**真实业务并不总是需要最强模型。分类、抽取、路由、意图识别、简单改写，往往小模型更划算；复杂规划、难代码、多步工具协作，才值得上 reasoning/frontier 模型。一个只会说我一般选最强的或者我一般选最便宜的同学，通常都没有做过生产权衡。

**第二，面试官会看你是否知道模型能力不是单一维度。**选型至少要看：

- 任务复杂度；
- 推理深度；
- 工具支持；
- 上下文长度；
- 结构化输出稳定性；
- 多模态能力；
- 延迟要求；
- 成本上限；
- 可用性与发布阶段（GA / preview）；
- 稳定性与回滚策略。  
真正系统设计时，这些维度往往相互牵制。

**第三，随着 OpenAI、Anthropic、Google 等平台都把模型家族做成大/中/小、reasoning/non-reasoning、多模态/轻量化分层，模型路由就成了自然选择。**OpenAI 当前文档已经明确建议：复杂任务可以从旗舰模型开始，若追求延迟和成本则选择 mini/nano 级别；Anthropic 官方文档长期以 Opus / Sonnet / Haiku 的分层进行说明；Gemini 模型页面则频繁出现 preview、deprecated、shutdown 节点，提醒开发者选型不仅看能力，也要看生命周期。  
这就意味着：**选型是一个动态系统问题，不是一次拍板。**

**第四，Agent 场景进一步放大了路由的价值。**规划、检索、执行、校验、总结几个阶段不必用同一个模型。强模型做规划和裁决，小模型做并行子任务、抽取和格式整理，已经成为 2026 年很常见的工程思路。

这一章可以用这样的面试口语话术表述：

> 💡 我们最初用单一大模型处理所有请求，效果还可以，但成本和延迟都偏高。后来把链路拆开做路由：复杂规划和最终审定仍交给强模型；文档抽取、证据整理、分类路由下沉到轻量模型；同时对系统 prompt 和工具 schema 做稳定前缀，提升缓存命中率。选型时我们不是看排行榜，而是根据任务完成率、格式合法率、平均延迟和单位请求成本做评测。最终整体质量基本持平，但成本显著下降，在线时延也更稳定。

### 二、先建立一个模型选型的基本框架

![](05_模型选型与路由_images/模型选型与路由/BfZBbNEuHoafJNx1v3nc2u2QnPh.svg)

这个图最重要的意义，不是告诉你某个分支永远固定，而是提醒你：选型从来不是只看模型名，而是看任务维度。一个成熟系统往往从需求出发，而不是先爱上某家模型。

### 三、模型选型到底在看哪些维度

#### 1. 任务类型

先问任务是什么。

- 问答/写作/总结：偏通用生成；
- 代码修复/多步规划：偏 reasoning；
- 分类/抽取/标签：偏结构化与低延迟；
- 实时语音/高频 Agent：偏低延迟；
- 图文理解/文档分析：偏多模态；
- 需要外部系统操作：偏工具使用可靠性。

如果任务分类都不清楚，后面谈选型基本没有意义。

#### 2. 正确率要求

有些任务只要差不多能用，比如草稿生成；  
有些任务必须尽量别错，比如合同审查摘要、报表分析、金融审批建议。  
正确率要求越高，通常越值得上更强模型、更多验证链路或多模型复核。

#### 3. 延迟要求

面向用户对话、实时语音、IDE 辅助、在线客服，延迟非常敏感。  
如果业务要求首 token 极快，哪怕强模型质量更好，也可能不适合。  
所以你在面试里应该明确区分离线批处理和在线交互，这是选型最基础的分层。

#### 4. 成本与吞吐

同样 100 万次请求，选旗舰模型和选轻量模型，成本可能差一个数量级。  
更重要的是，并发能力还会受上下文长度、KV Cache、缓存命中率和工具循环影响。  
真实系统里经常是先用强模型打样，再用 eval 驱动看能否下沉到更便宜模型。

#### 5. 上下文长度与上下文管理能力

长文档、多文件、多轮会话、大代码库、企业知识系统都会碰到上下文上限问题。  
但你不能只看最大 context，还要看：

- 长上下文利用率；
- prompt caching/context caching 支持；
- compaction/support summary 能力；
- 多模态长上下文兼容性。

#### 6. 工具与结构化能力

Agent 系统里，这一维经常比通用写作能力更重要。  
你要看：

- function calling/tool use 是否成熟；
- structured outputs 是否严格；
- 多工具并行/程序化工具能力；
- 错误返回与 trace 可观测性；
- 是否支持 web/file/code/computer use 等原生能力。

#### 7. 模型生命周期与发布阶段

这个点特别容易被忽略。  
preview 模型可能能力很强，但：

- 行为变动快；
- 稳定性波动大；
- 参数建议变化快；
- 可能被较快弃用或替换。  
Gemini 文档里的 deprecation/shutdown 提示是一个非常典型的提醒：  
选型不只是看今天能不能跑，也要看未来三个月稳不稳。

### 四、截至 2026-04 的主流厂商分层认知，你应该怎么讲

#### 1. OpenAI：从用哪个模型走向按任务选择 reasoning / GPT / mini / nano

截至 2026-04，OpenAI 模型文档已明确给出分层建议：复杂专业工作或复杂推理优先旗舰模型；追求延迟和成本时考虑 mini/nano；reasoning 模型与普通 GPT 模型在 prompting 和 usage 上有差异。模型页面还直接展示 context window、tool support、reasoning effort、价格层级等信息。  
对面试来说，你不需要背所有型号，但最好知道一种说法：  
**OpenAI 家族已经把能力、速度、成本、工具支持显式产品化了，选型不能只看模型名，而要看家族定位。**

#### 2. Anthropic：Opus / Sonnet / Haiku 的工程分层非常清晰

Anthropic 长期用 Opus、Sonnet、Haiku 代表从最高能力到更高性价比的分层。到 2025–2026 年，Anthropic 文档又叠加了 structured outputs、prompt caching、extended/adaptive thinking、Agent SDK、advanced tool use 等能力。  
你在面试里可以这样概括：

- Opus：更适合极高复杂度与高质量要求；
- Sonnet：常作为默认生产主力，平衡质量、速度与成本；
- Haiku：适合高吞吐、低延迟和轻量任务。  
如果再补一句Anthropic 近两年特别强调 long-running agents 的 harness/context/tool 设计，会更像跟进过最新生态。

#### 3. Gemini：强多模态、长上下文、thinking 与预览节奏快

Gemini 家族到 2026 年的特点非常鲜明：

- 多模态与长上下文是强项；
- thinking 被当成正式能力暴露；
- 3.x / 2.5 等不同系列在温度建议、能力定位、预览状态上差异较大；
- 模型页面和 changelog 中常见 deprecation/shutdown 提示，说明选型要重视生命周期管理。

面试里如果你能提到Gemini 3 文档明确建议 temperature 默认 1.0，说明同样的调参经验不适用于所有家族，会体现你会看官方资料而不是只背旧经验。

### 五、为什么模型路由比选一个最好的模型更重要

#### 1. 任务天然分层

一个典型 Agent 请求可能分为：

- 意图识别；
- 检索或搜索；
- 计划生成；
- 子任务执行；
- 结果总结；
- 结构化回填。

这些步骤对模型要求不同。  
用一个最强模型串到底，常常既贵又慢，也未必最稳。

#### 2. 路由可以做高低搭配

例如：

- 大模型做计划与最终审定；
- 小模型做文档抽取、标签整理、证据预处理；
- 超轻量模型做 spam/安全预检；
- 规则引擎先做确定性分流，模型只处理剩余复杂样本。

这种策略在 2026 年已经非常常见，尤其在代码 Agent、办公自动化、运营分析中。

#### 3. 路由让你能用 eval 驱动降本

先用强模型建立 baseline，再用真实样本看看哪些任务可以安全下沉到更便宜模型，是非常成熟的策略。  
如果你在面试里主动讲我会先建立质量基线，再评估哪些子任务能下放到 mini/haiku/flash-lite，这是很强的工程信号。

### 六、几种常见路由策略

#### 策略 1：静态任务路由

按任务类型固定模型。例如：

- 分类 → 小模型；
- 长文分析 → 中大模型；
- 复杂代码 → reasoning/frontier。  
优点是简单可控；缺点是同类任务内部复杂度差异可能被忽略。

#### 策略 2：规则 + 阈值路由

根据输入长度、是否多文件、是否有工具、是否要求严格 JSON、是否涉及高风险动作等条件决定模型。  
这是很多系统的第一代路由器，落地成本低。

#### 策略 3：级联路由（cascade）

先让便宜模型做，置信度不够或检测到复杂度过高时，再升级到更强模型。  
它很适合抽取、分类、路由、评审这类可量化置信度的任务。

#### 策略 4：多模型协同

一个模型负责规划，一个模型负责检索总结，一个模型负责最终裁决。  
这适合复杂 Agent，但系统设计和观测成本也更高。

#### 策略 5：回退与降级

当主模型超时、限流、preview 波动或某区域故障时，自动回退到兼容模型。  
这个在高可用系统里非常重要，但很多校招同学完全不提。

### 七、模型选型的实践方法：面试里最好按这个顺序回答

#### 步骤 1：定义任务与指标

先明确你要优化的是：

- 准确率；
- 格式合法率；
- 延迟；
- 成本；
- 工具成功率；
- 用户满意度；  
没有指标，就没有选型。

#### 步骤 2：用强模型建立上界

先用一个足够强的模型做 baseline，确定这个任务理论上能做多好。

#### 步骤 3：做失败分类

错误是因为模型不够强、证据不足、prompt 不好、工具不稳，还是输出解析崩？  
不同根因，对应不同选型决策。

#### 步骤 4：尝试向下路由

把适合下沉的任务迁到更便宜更快的模型，观察质量损失是否可接受。  
这是最实用的降本路径。

#### 步骤 5：补缓存、压缩和工作流优化

很多时候不是非换模型不可，prompt caching、context engineering、structured outputs、tool schema 改善就能把模型表现拉上来。  
选型不应该掩盖系统工程问题。

### 八、高频面试题与答题要点

#### 问题 1：你怎么选模型？

先看任务类型与验收指标，再看复杂度、延迟、成本、上下文、工具/结构化支持，最后通过样本评测做决策。

#### 问题 2：为什么不直接用最强模型？

因为不是所有请求都需要最高智能，最强模型往往更贵更慢；系统目标是综合最优而不是单点最强。

#### 问题 3：什么时候应该上 reasoning 模型？

多步推理、复杂代码、复杂约束一致性、多轮工具协作、高风险分析场景更值得上 reasoning 或更强模型。

#### 问题 4：什么时候适合小模型？

分类、抽取、路由、改写、模板填充、高频轻量 Agent 子任务，以及对延迟/成本极敏感的场景。

#### 问题 5：模型路由是什么？

根据任务特征、复杂度、成本与 SLA，动态把请求分配给不同模型或模型组合的机制。

#### 问题 6：preview 模型能不能直接上生产？

可以试，但要谨慎。要准备行为波动监控、回退策略、版本对比和 deprecation 预案。

#### 问题 7：如何做降本？

先建立强模型 baseline，再通过 eval 发现可下沉任务，配合缓存、上下文压缩、结构化输出和更细粒度路由实现降本。

#### 问题 8：长上下文模型就一定更适合长文档任务吗？

不一定。还要看长上下文利用率、缓存能力、证据组织方式和实际任务结构。

#### 问题 9：Agent 系统为什么常用多模型？

因为规划、执行、抽取、总结等阶段需求不同，用单一模型串到底通常不经济。

#### 问题 10：模型选型要不要考虑工具支持？

必须考虑。Agent 系统里，function calling、structured outputs、native tools、错误处理能力往往和通用写作能力同等重要。

### 十、常见误区

第一个误区，是把模型选型等同于挑一个最聪明的。  
真实系统追求的是 Pareto 最优。

第二个误区，是忽视模型生命周期。  
preview、deprecated、shutdown、region availability 都会影响生产可用性。

第三个误区，是只比较排行榜，不比较接口能力。  
在 Agent 场景里，structured outputs、tool use、缓存、上下文管理能力可能比某个 benchmark 排名更关键。

第四个误区，是没有回退策略。  
一旦主模型限流、波动或升级回归，没有 fallback 的系统很脆。

### 十一、截至 2026-04 的一个重要行业变化

2026 年一个非常明显的趋势是：  
**模型本身正在变成可编排资源，而不是单一核心依赖。**

OpenAI 的最新模型体系把 reasoning、mini、nano、tool support、prompt caching、长上下文放在统一 API 体系里；Anthropic 从模型能力延伸到 Agent SDK、context engineering、advanced tool use；Gemini 则在 models/changelog 中持续提醒开发者关注 preview 节奏与能力更新。  
这意味着未来面试里，你会不会选模型其实越来越接近你会不会设计资源调度策略。

### 十二、你应该记住的结论

如果只记一句话：  
**模型选型的目标不是找到‘最好的模型’，而是为不同任务找到质量、延迟、成本和稳定性的最优组合。**

再记一句：  
**路由不是可选优化，而是多模型时代的默认架构思维。**

### 资料来源与延伸阅读

#### 官方文档

1. OpenAI Models / Model Selection / Latest Model Guide  
[https://developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models)  
[https://developers.openai.com/api/docs/guides/model-selection/](https://developers.openai.com/api/docs/guides/model-selection/)  
[https://developers.openai.com/api/docs/guides/latest-model/](https://developers.openai.com/api/docs/guides/latest-model/)
2. OpenAI Reasoning Best Practices / Latency Optimization / Pricing  
[https://developers.openai.com/api/docs/guides/reasoning-best-practices/](https://developers.openai.com/api/docs/guides/reasoning-best-practices/)  
[https://developers.openai.com/api/docs/guides/latency-optimization/](https://developers.openai.com/api/docs/guides/latency-optimization/)  
[https://developers.openai.com/api/docs/pricing/](https://developers.openai.com/api/docs/pricing/)
3. Anthropic Models Overview / Release Notes / Pricing  
[https://docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models)  
[https://docs.anthropic.com/en/release-notes/overview](https://docs.anthropic.com/en/release-notes/overview)  
[https://docs.anthropic.com/en/docs/about-claude/pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
4. Gemini Models / Changelog / Pricing / Gemini 3 Guide  
[https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)  
[https://ai.google.dev/gemini-api/docs/changelog](https://ai.google.dev/gemini-api/docs/changelog)  
[https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)  
[https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)

#### 补充阅读

1. OpenAI Cookbook: Model Selection Guide  
[https://developers.openai.com/cookbook/examples/partners/model_selection_guide/model_selection_guide/](https://developers.openai.com/cookbook/examples/partners/model_selection_guide/model_selection_guide/)
2. Anthropic Engineering（advanced tool use / harness / context engineering）  
[https://www.anthropic.com/engineering](https://www.anthropic.com/engineering)

### 补充 · 主流模型对比与选型（B 套）

> 来源：购买资料 B（原文第 16420–16983 行）

#### 7 不同模型的对比和选择

      有些公司在面试的时候，喜欢问的一个问题是，你的项目用的什么模型，为什么要用这个模型，比如你可以看到笔记面经里的小红书，平安证券，都有类似的问题。 其实使用什么模型这个事情，不光和模型本身有关，也和公司层面（比如公司有自己自研模型，那产品肯定接入自家模型），政治方面因素相关（中国很多产品，政治上也不让用国外模型，国外的模型比如Claude系列，也会限制中国的使用）。

这一章，首先讲解 7.1 讲解市面上所有的主流模型的典型特点。 7.2 结合面试题：你的项目使用什么模型 来讲解 项目模型选择的策略。 7.3 讲解一下最新典型旗舰模型的特点。

##### **7.1 主流模型的对比**

本章会概括所有主流模型，看完这一章，你能够对市面所有模型有一个概念，印象，不追求多深入，但是你最少能知道每个模型是那个公司，他最核心的特点，优缺点，大概的选型原则。注意模型迭代速度其实非常快，这个章节时效性很强（此章节整理于2026/5/10）。不过**大体的趋势和特点**还是相对短期稳定的，比如GPT模型强在生态，Claude模型强在编程，Gemini模型在各大Benchmark屠榜。看完本节，你会了解目前最主流的模型的特点，优缺点，就算不从面试的角度来说，作为谈资也是值得一看的。

###### 7.1.1 通用大模型

###### 7.1.1.1 闭源阵营

###### **7.1.1.1.1 GPT (OpenAI)**

>  **一句话定位：** AI 开山鼻祖，用户量大，生态好，通用能力最强。

\- **当前旗舰模型：** GPT-5.5 (2026-05-05)

**模型矩阵**

\- **GPT 主线（GPT-5.5）**：通用聊天 / 多模态 — 日常全能任务。

\- **O 系列（最新 O 系列推理模型）**：纯推理线，回答前先"思考" — 数学、逻辑、多步工程。

\- **Image 系列（gpt-image-2）**：图像生成，取代 DALL·E — 海报、文字渲染、图文。

\- **语音 / 实时（Realtime API + 语音模型）**：低延迟语音交互 — 语音助手、电话机器人。

\- **视频系列**：已无在售产品（Sora 已停服）。

**核心优势**

\- **生态最大：** 数亿用户、最多第三方插件与应用构建在 GPT 上。

\- **多模态最齐全：** 文 / 图 / 语音 / 实时全覆盖（视频暂缺）。

\- **顶级文字渲染：** \`gpt-image-2\` 的文字渲染业内顶级，能正确拼单词、做海报。

**劣势与短板**

\- **不再是单项绝对王者：** 榜单常被 Gemini 反超，编码上被 Claude 压制。

###### **7.1.1.1.2 Gemini (Google)**

>  **一句话定位：** 榜单领跑者；最大筹码是深度嵌入 Google 全家桶。

\- **当前旗舰模型：** Gemini 3.1 Pro

**模型矩阵**

\- **Pro（Gemini 3.1 Pro）**：旗舰 — 难题、长文档、复杂多模态。

\- **Flash（Gemini 3 Flash）**：速度款，约 Pro 的 90–95% 能力 — 日常高频任务，更快更便宜。

\- **Flash-Lite（Gemini 3.1 Flash-Lite）**：极致性价比 — 高吞吐 / 大规模批处理。

\- **Deep Think（Gemini 3.1 Deep Think）**：深度推理模式（仅 AI Ultra 订阅） — 科研、工程、复杂技术难题。

**核心优势**

\- **多模态强：** 拍照识物体场景实用度高（如修车工拍零件即得识别结果）。

\- **生态优势**：集成了Google全家桶，比如Gmail, Chrome（严格说这个不算模型的能力，算应用的能力）

\- **榜单领跑：** 2025 AIME测试上（测试数学推理），Gemini模型领跑，其次是Claude, 然后是GPT。

###### **7.1.1.1.3 Claude (Anthropic)**

>  **一句话定位：** 编码、长文档、Agent 任务的专家；多模态偏弱，但单项做到顶。

\- **当前旗舰模型：** Claude Opus 4.7 (2026-04-16 发布)

**模型矩阵**

Anthropic Claude 三档定位：

\- **Opus（Claude Opus 4.7）**：旗舰，研究实验室级 — 硬骨头、复杂工程、深度分析。

\- **Sonnet（Claude Sonnet 4.7）**：中端，约 Opus 80% 实力 — 日常编码、长文档处理，性价比高。

\- **Haiku（Claude Haiku 4.7）**：轻量级，速度快、成本低 — 高并发、实时响应、批处理、简单任务。

**核心优势**

\- **编码优势：** LiveCodeBench、SWE 等"真实代码库"基准排名靠前；开发者社区编码首推。

\- **长文档分析：** 合同、论文、整套代码库给出结构化摘要而非零散答案。

\- **风格客观：** 风格"最不谄媚"，直接告诉你想法烂在哪，不无脑捧场。

**劣势与短板**

\- **多模态弱：** 无原生图像生成，纯文本 / 代码专家。

\- **生态缺位：** 没有自家语音 / 视频线产品。

###### **7.1.1.1.4 Grok (SpaceXAI)**

这个Grok估计不太会问了，作为国外模型，不如前三个亮眼。我还是总结大家了解一下。

> **一句话定位：** 实时 X（Twitter）集成 + 最自然的对话感；尺度大、争议多。

\- **当前旗舰模型：** Grok 4.3 Beta (2026-04-17 发布)

**模型矩阵**

\- **主线（Grok 4.3 Beta）**：当前旗舰，推理 / 通用 — 综合任务、推理。

\- **Fast 档（Grok 4.1 Fast）**：工具调用 / 代理工作流 — Agent、长上下文工具链。

\- **图像 / 视频（Grok Imagine + Aurora）**：图像 + 视频统一管线 — 出图、短视频。

**核心优势**

\- **实时 X 集成：** 拉热门讨论、突发新闻摘要、舆情分析比爬虫式模型快得多。（这个严格来说也是产品的能力，不是模型的能力）

\- **对话自然：** 对话风格自然放松，像跟人聊天，半夜 3 点也秒回。

\- **言论尺度大：** 会回答其他模型常拒答的问题。

**劣势与短板**

\- **态度主观：** 严肃分析场景下，"会反驳的模型"反而更受偏好。

\- **争议多发：** 多次因系统提示问题、深伪图像、Grok Imagine "Spicy" 模式等卷入争议。

###### **7.1.1.2 开源阵营**

开源意味着：完全控制 = 数据不出门 + 无 API 费 + 离线可用（电费你出）。

###### **7.1.1.2.1 DeepSeek**

> **一句话定位：** 开源 + 价格屠夫 + MoE 高效；前沿 AI 不再需要十亿美元级预算的代表。

\- **当前旗舰模型：** DeepSeek-V4 (2026-04-24 发布预览)

**模型矩阵**

\- **V 系列 / 通用主线（V4-Pro / V4-Flash）**：通用聊天 + 思考 / 非思考双模式 — 日常 + 推理一体。

\- **R 系列 / 纯推理（R1）**：引爆 2025 "Sputnik 时刻"，目前路线已并入 V 系列。

\- **Coder（DeepSeek-Coder）**：编码 — 代码补全、生成。

\- **Math / Prover（Math-V2 / Prover）**：数学与定理证明 — 数学竞赛、形式化数学。

\- **视觉（DeepSeek-VL2）**：图文理解。

**核心优势**

\- **极致高效：** 架构 MoE + MLA（自 V2 起），参数量大但每次只激活一小部分，又快又省。

\- **开源与低价：** 权重 MIT 开放可本地部署；API 价格远低于美国一线。

\- **垂直矩阵齐全：** 编码 / 数学 / 证明 / 视觉各有专精模型。

###### **7.1.1.2.2 其它模型**

剩下的模型，我用一个表格，一句话总结其它模型最核心的特点：

\- **Meta（LLaMA 4）**：最高约 400B 参数 — 开源浪潮起点，2026 上半年有更大版本。

\- **阿里（Qwen 3.5）**：双 3090 本地可跑 — 多语言强，本地体验逼近 Claude Sonnet。

\- **智谱 AI（GLM-5）**：203K tokens 上下文 — 开源榜顶尖，许可证商用友好。

\- **Moonshot（Kimi K2.5）**：Perplexity 可用 — 数学 / 推理强，AIME 2025 高分。

\- **Mistral（Mistral 系列）**：小模型见长 — 以小博大，欧洲语言出色。

###### 7.1.2 视觉生成模型

> 视觉生成模型和视频生成模型不作为重点。从面试角度来说，那种专门做视频，多模态相关的岗位会侧重视觉模型和视频生成模型，找工作如果没有这方面的倾向（比如我），不需要深入了解。所以这两章只是简单总结，大家有个印象就行。

\- **美感极致 → Midjourney**：艺术质量之王，画面电影感、精致；约 \$10/月起。

\- **简单易用 → gpt-image-2**：内嵌 ChatGPT，原生多模态，**文字渲染业内顶级**（能正确拼单词、排版海报）。

\- **精准理解 → Flux**：开源、本地、免费；**Prompt 语义还原度业内领先**。

\- **极度可控 → Stable Diffusion 3.5**：开源本地，配合 LoRA、ControlNet 控制力极强；学习曲线陡，但灵活度无敌。

**需要避开的误区**

**模型是物理分离的：** 文本模型和图像模型几乎总是分开的系统。例如，你在 ChatGPT 里画图，实际调用的是 \`gpt-image-2\`（已取代 DALL·E），而不是 GPT 语言模型本身；Grok 出图也是独立的 Grok Imagine 管线。

###### 7.1.3 视频生成模型

> 本身不做视频内容，面试也很少问，这小节看看就行吧，算是科普了。

\- **Sora（OpenAI）**：重大变动——已停服，API 将在 9 月彻底关闭，短期内不可用。

\- **Kling 3.0**：主打速度与便利，支持音视频一次生成，榜单表现已反超 Sora 2 Pro。

\- **Runway Gen-4.5**：给创作者极强控制力，提供运动笔刷、镜头一致性、相机引导功能。

\- **Seedance 2.0**：字节跳动出品，当前文生视频榜单领跑者之一。

\- **Grok Imagine**：图像与视频统一管线，已上线高质量模式 API。

###### 7.1.4 面试问题参考

**Q：你平时工作和学习中用过哪些模型，分别用来做什么？**

> 面试官可能问这个问题，考一下你对AI 是否聪明熟练地使用AI工具。这个回答是根据上面不同模型的特点总结的，有点多，主要是提供个思路，根据不同模型的特点来在不同的场景下使用。这样回答体现你对不同模型特点都有理解，也会聪明使用。

用过挺多的，不同场景我会选不同的模型，因为各家模型的优势方向差别还是比较明显的。

**编程和写代码这块，我基本首选 Claude。**它在 LiveCodeBench 这类真实代码库评测上一直排名靠前，开发者社区里口碑也最好。日常写代码、调 bug、看别人的代码逻辑，我用 Sonnet，性价比高，够用；遇到比较复杂的架构设计或者系统级的问题，我会升级到 Opus，它在推理深度上确实更强。另外 Claude 有一个特点我很喜欢，它不太会无脑夸你，说法比较直接，方案有问题它会直说，做技术决策的时候反而更可信。

**GPT 我主要用在两个场景**。一个是日常通用问答，因为它生态最成熟，各种插件和工具支持都齐全，随手查个东西、聊个想法很顺手；另一个是图像生成，`gpt-image-2` 的文字渲染我觉得是目前最好的，做海报、图文内容、有文字的封面，它比其他模型准确多了

**Gemini 我主要用来处理长文档和多模态任务**。它和 Google Docs、Drive 的整合很自然，工作流上比较顺。日常高频的任务我一般用 Gemini Flash，它的能力大概是 Pro 的 90–95%，但速度更快、价格更低，够用的情况下没必要上 Pro；遇到真正复杂的多模态分析、长文档深度阅读这类场景，才切换到 Pro。

**DeepSeek 我用在对成本比较敏感或者需要本地部署的场景**。它的 API 价格比美国一线模型便宜很多，而且开源可以本地跑，数据不出门，对于一些不想上传到外部服务器的内容，本地跑 DeepSeek 很合适。数学推理这块它也很强，做一些计算密集型的任务我会考虑它。

**Grok 我偶尔会用来做实时舆情和热点信息的查询**，因为它直接整合了 X（Twitter）的数据，对突发事件、技术圈动态的感知比其他模型快很多，这块是它的独特优势。

总体来说，我的习惯是：**编程找 Claude，通用和出图找 GPT，长文档找 Gemini，省钱或者本地部署找 DeepSeek，追热点找 Grok**。不同场景用最合适的工具，而不是只盯着一个模型用到底。

###### 7.1.5 参考资料

文档的内容基本按照这个视频来总结的。不过这个视频有一些错误的地方，比如Openai的图像模型用的早都不是DALLE 而是Image，时效性有问题，比如现在claude 4.7，GPT 5.5 都出了。这些我在文章内更正了

https://www.bilibili.com/video/BV1hWo1BXEko/?spm_id_from=333.337.search-card.all.click&vd_source=144bec9c3f54e465073138bed788be1b

###### 7.1.6 视频讲解

直接看这个7.1可能有点枯燥和流水账，这个视频把7.1 小节的内容讲了一遍，结合视频看更轻松

https://www.bilibili.com/video/BV1oP5x6iEcG/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

##### **7.2 模型的选型**

> 介绍一个考虑模型选型的模板，这块有一些产品思维，参考文档也是从一个产品经理的论坛文章上看的。

###### 7.2.1 模型选择策略理论

最佳的选型策略应当是从业务需求反推技术选择，构建 **场景 - 能力 - 模型** 的三步决策框架。

**第一步：定义场景 (精准描述问题与流程)**

选型的起点必须是具体的业务场景，切忌模糊的大词，建议采用“**黄金圈法则**”进行拆解：

\- **Why (价值目标) :** 该场景要解决什么核心痛点？（例如：降低20%的客服人工介入率）

\- **What (任务定义) :** 具体要完成什么任务？（例如：自动回复用户的订单状态查询）

\- **How (工作流程) :** 任务的执行流程与限制是什么？需要多快的响应速度？是否有数据不出境的硬性要求？

**第二步：拆解能力 (分析核心能力需求)**

将明确好的业务场景，转化为对大模型具体的可量化能力。

\- **分类拆解:** 明确场景最看重的是什么能力。是信息抽取、内容生成、复杂逻辑推理，还是外部工具调用（API集成）能力？

\- **划分优先级:** 将需求划分为“必要能力”与“加分能力”，并为各项核心能力分配权重。例如：在智能客服中，工具调用准确率可能是必要能力（占50%权重），而多语言翻译可能是加分能力（占10%权重）。

**第三步：匹配模型 (寻找场景最优解)**

根据拆解出的能力权重，对候选模型进行综合评估：

\- **能力适配度:** 拒绝“榜单依赖症”（如通用的MMLU分数）。必须从真实业务中抽样构建场景化测试集（如100个真实案例）进行盲测打分。

\- **成本效益比 (TCO):** 不能只对比单次Token调用价格，必须将业务高峰期的调用量波动、本地化私有部署硬件成本、配套人工审核维护成本计算在内。

\- **风险可控性:** 评估数据安全隐私、合规要求以及模型供应商的服务稳定性。在金融/医疗等敏感领域，合规和数据不出境往往具备一票否决权。

###### 7.2.2 实战演示

> 我结合我们笔记中的项目：智能预约系统来演示一下上面这个理论的应用。大家要是面试问到这个问题，根据你自己的项目往里面套模板就行。从另一个角度来说，如果你还没有做项目，真的可以考虑一下这个原则，在做项目之前好好考虑一下应该用什么模型。

以一个真实的 Agent 项目为例，演示如何将"场景 - 能力 - 模型"框架落地。该项目背景是：传统按摩房依赖人工前台接听电话，完成预约分配、咨询解答、客户回访等工作，效率低、成本高。因此设计了一套多 Agent 对话系统来替代人工前台。

**第一步：定义场景**

按摩房 Agent 项目的 Why / What / How：

\- **Why（价值目标）**：解放人工前台，实现 7×24 小时自动预约与咨询，降低人力成本。

\- **What（任务定义）**：用户通过对话完成技师预约、项目咨询、个性化回访。

\- **How（工作流程）**：用户发起对话 → 意图分类 → 分流至预约 / 咨询机器人 → 数据库查询 / RAG 检索 → 确认预约并推送天气提醒。

系统最终拆解为 4 个 Agent：**分类机器人**（意图路由）、**预约机器人**（多轮收集需求 + 数据库查询）、**咨询机器人**（从私有文档 RAG 检索回答）、**行为分析 Agent**（分析历史预约、生成个性化回访）。

**第二步：拆解能力**

项目所需 LLM 能力及权重：

\- **意图分类准确性（必要，35%）**：分类错误会导致整个流程跑偏，是系统的咽喉。

\- **工具调用 / Function Call（必要，30%）**：预约机器人需要精准调用数据库查询技师空档。

\- **RAG 检索整合（必要，20%）**：咨询机器人须从私有文档中准确检索按摩房信息。

\- **多轮对话上下文理解（必要，10%）**：预约流程需多轮收集用户偏好，不能"失忆"。

\- **MCP 外部服务集成（加分，5%）**：预约成功后调用天气 MCP Server，生成个性化提醒。

**第三步：匹配模型**

系统采用**分层选型策略**，不同 Agent 所需能力不同，不必全部使用同一个高价模型：

4 个 Agent 的推荐模型与理由：

\- **分类机器人 → GPT-4o-mini / Qwen-Turbo**：任务简单（4 分类），轻量模型成本低、响应快。

\- **预约机器人 → Claude Sonnet 4 / GPT-4o**：工具调用稳定性高，多轮上下文理解强，是系统核心。

\- **咨询机器人 → Claude Sonnet 4 / DeepSeek-V3**：RAG 整合流畅，文档理解能力强；DeepSeek 成本更低。

\- **行为分析 Agent → DeepSeek-R1 / GPT-4o Thinking**：需对历史数据做多步推理，生成个性化回访文案。

###### 7.2.3 面试回答示范

**Q：你的项目是如何进行模型选型的？**

> 我用这个思路总结答案：
> 
> 1. 通过需求确定基本模型：使用上面的**三段理论：业务场景 - 功能 - 模型 来回答**。确认大致模型。
> 
> 2. 从大致意向模型里，做对比（查测评表，资料，做实验等方式）确定最终模型。
> 
> 第二点更好一点的方式是通过实验驱动，对比不同模型。但是如果这么说，面试官可能会问你真的怎么做的？怎么测评的，数据集多少，万一你答不上来，可以就从查测评表，查资料来做对比确定而不是做实验确定。

第一段（按需求确定大致模型）：

我在做按摩房智能预约系统的时候，是从**业务场景出发，反推需要什么能力，再去匹配模型**。这个系统有四个 Agent——分类机器人、预约机器人、咨询机器人和行为分析 Agent，每个 Agent 的任务差别很大，所以我没有用一个模型一刀切，而是**先按"业务场景 - 功能能力 - 模型"分别拆**。**分类机器人**只是判断用户意图属于哪一类，任务简单，所以**倾向用轻量模型，成本低、响应快**；**预约机器人是系统核心**，要多轮确认时间和技师偏好、还要调数据库查空档，对工具调用稳定性和多轮上下文要求最高，所以要用主力模型；**咨询机器人**主要做 RAG，从私有文档里检索回答，重点是**文档理解能力**；**行为分析 Agent** 在后台异步跑，需要对历史数据做多步推理，所以倾向**推理型模型**。这样一轮拆下来，每个 Agent 大致用哪一类模型就基本定了。

第二段（在候选模型里对比，最终确定）：

**确定大致方向之后，我会在每一类的候选模型里再做一次对比来定型，主要是查各模型的公开测评和资料**，结合我们的场景需求来选，而不是盲选最贵的。以分类机器人为例，它属于轻量模型这一档，候选的有 GPT-4o-mini 和 Qwen-Turbo。因为我们的用户提问基本都是中文、而且偏口语化，所以我重点看的是"中文意图分类的准确率"这个维度，同时也参考了调用成本和响应速度。综合下来 **Qwen-Turbo 在中文短文本分类上表现够用、成本更低、响应也快**，**所以分类机器人最终选了 Qwen-Turbo**；其它几个 Agent 也是按同样的思路，结合它们各自最看重的能力维度去比对确定的。

##### 7.3 热门模型特点介绍

这一章主要是给大家提一个醒。作为最火的，最新的，上热搜的模型，大家可以了解一下它的核心特点，做了什么改进。我知道我们都不是专业做模型的，所以对里面技术细节不会深入了解。我的建议是，新模型，比如gpt5.5, deepseek v4 出来以后，让AI给你总结下它的核心提升和改变，特性就好了。这么做是防止面试官问（因为我之前有被问到过。 我主要提供个思路，打个样。以Deepseek v4为例，让AI总结一下特性。防止面试官和你聊最近最新Deepseekv4, 你啥也不知道。更重要的是这个思路，后面还有各种新模型的发布，都可以用这个策略快速准备下。

###### 7.3.1 DeepSeek V4 新特性和创新

**新特性：**

1. 百万上下文成为默认能力。全系标配 **1M token 上下文。**推理计算量降至 V3 的约 27%，KV Cache 仅为 **10%，能直接处理整本书、完整代码仓库、长文档分析。**

2. 双模型体系覆盖不同场景。V4-Pro 提供万亿参数级高性能推理能力，而 V4-Flash 在维持相同架构的前提下降低激活参数和成本，实现高吞吐和低延迟的生产部署。

3. 推理效率和成本显著优化。通过压缩注意力和系统级优化，KV Cache 内存占用降低约 90%，整体推理吞吐明显提升，同时 API 成本显著低于同级模型。

4. 原生增强 Agent 执行能力。模型内置工具调用、分步推理和多模式思考能力，在复杂任务拆解和自动化工作流中具备更高稳定性和执行效率。

5. 开源和工业级部署能力并存。模型以 MIT 协议开放完整权重，支持多种硬件平台部署，使其不仅是研究模型，同时具备企业级落地能力

**创新**

1. 混合注意力机制重构长上下文计算。通过 CSA（压缩稀疏注意力）和 HCA（重度压缩注意力）的协同设计，将原本 O(n²) 的全量注意力转化为压缩与稀疏选择结合的计算模式，从根本上降低长序列计算成本 。

2. 稀疏索引与重要Token选择机制。模型引入索引器和 Top-k 筛选策略，只对最相关的上下文进行注意力计算，从“全量扫描”转变为“关键检索式推理” 。

3. mHC 超连接替代传统残差结构。通过引入流形约束的超连接机制改善深层网络中的信息传播稳定性，使万亿级模型训练更加可控和高效。

4. Muon 优化器提升训练稳定性。采用新型优化算法替代传统 AdamW，在大规模训练中实现更快收敛速度和更稳定的参数更新过程 。

5. 混合精度计算进一步压缩资源消耗。结合 FP4 与 FP8 的混合精度设计，在保持模型性能的前提下降低显存占用并提升计算吞吐。

6. Batch Invariance 提升工程可控性。通过保证相同输入在不同 batch 组织下输出一致，使模型在训练、推理和在线服务中具备更强的可复现性和稳定性。

---

###### 7.3.2 Jev ：面向软件的快速概率决策模型

Jev是2026年9月份快速火起来的一个模型，如我们一直说的，大模型圈，爆火的内容你不能不会。面试几乎一定会问到。所以2026年9月份，面试前，建议学习一下Jev。 大家也不用担心学不过来，最开始我们只要先理解最基本的内容，最简单的面试问题就够了。如果他持续爆火，我们再深入学习。

这一期视频我就总结的内容都是Jev最核心的内容：**是什么，特点，设计理念，使用方式，技术架构和面试真题**，希望大家可以用1小时的时间，结合视频和文档快速理解Jev是什么，如果后续面试对Jev的考察持续加深，我们也会持续跟进的。

###### 7.3.2.1 概念：Jev 是什么

###### 7.3.2.1.1 和 Opus、GPT 最大的不同

**Jev 是 TypeSafe AI 推出的一个决策模型。** 和我们熟悉的 Opus、GPT 系列相比，它不是为了写出一段回答，而是为了快速回答软件中的具体选择题。

Opus、GPT 这类模型的典型文本生成方式是**自回归生成**：根据输入和已经生成的内容，预测下一个 token（next-token prediction），再把新 token 接到上下文后面，继续预测，直到回答结束。哪怕要求只返回一个分类标签，典型生成接口也会把它作为 token 序列输出。

Jev 则要求你先定义问题和允许的结果。例如，给它一封邮件，再给出“账务、售后、技术支持”三个选项，它返回类别及对应概率，而不是逐 token 写一段解释。这种方式的定位是**并行采样的、有类型约束的概率决策**；底层架构尚未完整披露。

简单说：**通用 LLM 擅长“组织和生成答案”，Jev 专注于“在定义好的结果空间里做判断”。** LLM 也能分类、返回结构化结果，区别不在于谁能输出 JSON，而在于模型针对什么任务优化。

![这张图用于对比自回归LLM与Jev决策接口的输出方式差异。上方是依次产生token的自回归LLM的输出示意，呈现了令牌依次输出的过程；下方是Jev决策接口的输出示意，向预定义的选项返回对应概率，Jev会针对“在定义好的结果空间里做判断”的任务，给出账务、售后、其他三类选项的概率结果。图中还标注了该内容为教学示意，非实际速度与内部架构，对应文档中Jev模型与通用LLM不同任务优化方向的说明，体现了二者输出逻辑的核心区别。](05_模型选型与路由_images/B-B39/EglobcEzSoFYQ2x3awscDocdnKf.png)

*动图 1：观察逐 token 输出与返回选项概率的差异。动画是接口行为示意，不表示实测速度或已知的内部计算步骤。*

###### 7.3.2.1.2 为什么能火：把高频小决策做得快、做得便宜

我们常用 Opus、GPT 做分析、写代码，也会通过 Claude Code 这样的工具完成多步骤任务。但如果只是给上千封邮件分类，关心的往往不是能否写出精彩解释，而是**多久处理完、花多少钱、标签是否可靠**。这里 Claude Code 是应用，Opus、GPT 是模型，不能把两者当作同一层级的基准对象。

一次千封邮件分类演示中，处理 **1,000 封邮件**时，Jev 初版流程耗时 **70 秒、费用 \$0.09**，对照模型 Luna 约需 **5 分钟（300 秒）、\$0.62**。按这组数字计算，Jev 的处理速度约为 Luna 的 **4.3 倍**，**耗时减少约 76.7%，调用成本降低约 85.5%**。

调整后端并行和请求组织后，Jev 又做到 **6 秒、仍为 \$0.09**：相较于上述 Luna 流程，批处理速度约为其 **50 倍，耗时减少约 98%，调用成本仍降低约 85.5%**。其中，50 倍包含了工程优化的贡献，并非同等配置下的模型速度对比；对照模型可核验的完整 ID 尚不明确，不能直接把数字改写成“比 Opus／GPT 快多少倍”。

其他演示包括**实时玩 Doom、让 50 个小镇居民在约 0.6 秒内完成一轮决策**。这些演示吸引人的地方，是把原本需要等待的模型调用，变成游戏或业务流程中可以频繁发生的一步。70–500 ms 的响应范围属于待按任务和配置验证的性能指标，并非任意负载下的延迟保证；加上创始人发布帖接近 3,000 万次浏览的热度，“快速、低成本决策”就成了它传播的核心卖点。

**因此，它的看点不是全面胜过 Opus、GPT，而是在分类、路由等窄任务上提供另一种速度与成本选择。** 上述演示缺少完整的同条件准确率测试，不能由“更快”推出“更聪明”或“不会判断错”。

###### 7.3.2.1.3 能做什么，不能做什么？

**通用大模型像在写申论题，Jev 则是在回答事先设计好的题目。** 它能回答的主要是三种：**是非题、单选题、打分题**，对应“是不是”“哪一个”“到什么程度”。

**第一种，是非题：问“是不是”。** 给它一个命题，它返回 0 到 1 之间的概率，越接近 1 越倾向“是”，越接近 0 越倾向“否”。例如，问“这张发票是不是诈骗？”，它可能返回 90%。程序再根据这个概率和业务规则决定是否转人工检查。概率是模型的判断，不是事实保证；阈值也需要按业务验证，不能直接照搬示例。

**第二种，单选题：问“哪一个”。** 先列出候选选项，Jev 从中选出最合适的一项，同时返回各选项的概率。选项及说明由你定义，选项上限为 255 项，实际以接入版本接口为准。例如，自动整理信箱时，先定义文件夹及其收录规则，再让 Jev 判断每封邮件应归入哪个文件夹。

**第三种，打分题：问“到什么程度”。** 有些事情不适合只分“是”或“否”，需要先定一把尺，写清楚从低到高每一级的含义；评分最多可分 11 级，实际以接入版本接口为准。例如筛选潜在客户：0 分是没有预算的学生，1 分是小团队，2 分是有明确需求和时程的公司，3 分是预算充足的大企业。某条大企业咨询可能得到 2.9 分，程序就可以按预设规则，将高于 2.5 分的线索优先通知业务主管。**这里的 2.9 是程度分数，不是概率。**

![图片展示了Jev能回答的三种题型。左侧是非题，如发票是否诈骗，返回0 - 1概率，接近1倾向“是”，接近0倾向“否”；中间是单选题，如邮件放入哪个文件夹，选项及概率由定义，最多255项；右侧是打分题，如客户优先跟进程度，返回尺子上分数，先定义等级含义，最多11级，示例中为2.9分。该图与上下文介绍Jev能回答的三种题型相契合，直观呈现其题型特点。](05_模型选型与路由_images/B-B39/WNKGbbuufo39bVxundBcM1yonUf.png)

**对于这类高频、简单、答案范围明确的判断，动用昂贵的通用大模型，往往有些“杀鸡用牛刀”。** Jev 的价值是把这些小决策做得更快、更便宜：上述千封邮件分类演示中，耗时从对照模型的 5 分钟缩短到 70 秒，成本从 62 美分降到 9 美分。在一个技能选择案例中，加入 Jev 预筛选后，错误率从 17% 降到 7.3%。这说明专门化方案在特定任务上也可能更准，但该案例缺少完整评测条件，不能据此说 Jev 在三类任务上的准确率都“秒杀”大模型。

**Jev 的出发点是：软件不总需要一个会长篇思考的助手，很多时候只需要一个快速、可靠的判断。** 因此，它不以更长的思考链和更强的通用推理为主要目标，而是面向高频决策，优化延迟、成本和概率的可靠性，返回程序能直接使用的结果。可以用 System 1（快速、直觉式判断）对比 System 2（审慎推理）来理解这一定位；这是设计比喻，不是模型架构的划分。

这种设计也带来明确的取舍：**把更多流程设计留给开发者，把运行时的局部判断交给模型。** 开发者定义问题、候选结果和流转规则，Jev 根据当前输入判断，程序据此选择分支。与大模型驱动的 Agent 在运行时规划、调整过程相比，这种方式需要更多前期编排，但在流程相对确定的任务中，有望换来更低的运行成本和更强的可控性。

**但快判断不等于强推理，Jev 也无法替代 LLM 的开放式生成能力。** 需要多步推理、复杂分析、方案构思，以及写文章、总结内容、生成代码时，仍应交给通用大模型。快棋场景就能说明这点：Jev 即使凭响应快让对手超时，也不代表棋力更强；客服场景也一样，它能判断工单该转给谁，但最终安抚客户的回复仍需大模型来写。两者应当分工：**Jev 负责快速判断，大模型负责推理和生成，程序负责执行。**

---

###### 7.3.2.2 技术实现：已知边界与 RLCD

###### 7.3.2.2.1 模型架构：尚未公开

**TypeSafe AI 尚未公开 Jev 的完整网络结构，无法确认它是否基于 Transformer，也不知道参数规模和具体输出头设计。** 已公开的技术描述包括新模型架构和并行采样器，但不足以还原其内部实现。

一种推测是：**Jev 仍用 Transformer 处理输入，但不让模型接着写文字，而是由专门训练的输出层直接计算类别概率或分数。** 例如，输入一封邮件后，直接返回“账务 90%、物流 10%”，而不是逐步生成“这是一封账务相关的邮件”。这种做法不要求把模型改成 Encoder-only；保留 Decoder-only 的主体结构，也可以通过训练专门的分类输出层来实现。

![这张图片展示了面向软件的快速概率决策模型Jev的两种模型架构，对应文档中Jev技术描述的内容。其中A选项为自回归文本生成示例，采用Decoder-only的Transformer Backbone，包含因果自注意力机制和前馈网络，通过Transformer主体计算输入得到隐状态，再经语言模型头得到输出；B选项为固定类别分类示例，同样基于Transformer Backbone，采用隐层状态的动态选择，将分类任务的隐状态映射为类别概率，且标注该方式仅适用于Jev的一种架构，为非官方方案。图片明确说明，这里的Decoder-only仅作为教学示例，不代表Jev采用该结构。](05_模型选型与路由_images/B-B39/AkXibhcXQouVB0xvrN0c6rXwn7c.png)

*架构动图：用 Decoder-only 作为共同的教学例子，不表示 Jev 已确认采用该结构，也不表示两者共享权重。下方仅展示固定类别分类；动态选项如何编码、并行采样如何工作仍未知。*

**注意：这个是一个架构的推测哈，因为现在Jev的架构尚未披露，上图和下面文字都是推测！**

看图时跟随上方蓝色、下方绿色光点：**两条路径都先经过 Transformer Backbone（主干网络），得到 Hidden State（隐藏状态），再进入不同的任务输出头。** 隐藏状态是计算得到的中间张量，不是独立的“表示层”；图中仅画出一个选定位置的 d 维向量。

上方的 **LM Head**把隐藏状态映射为词表 Logits（未归一化分数），再经 Softmax 转为下一个 token 的概率。图中用 argmax 选择 token 作示例，选出的 token 经 Autoregressive Loop（自回归生成循环）接入下一步，直到遇到结束标记。生成会复用已有 KV Cache，不是每一步重算完整输入。

下方的 Classification Head（分类头）把隐藏状态映射为固定类别的 Logits，再经 Softmax 得到类别概率，返回结果后结束。**两条路径都有分数和概率，区别是预测 token 还是预测类别，以及是否继续运行文本生成循环。**

所以，推测中省去的是**逐 token 生成的循环**，不是把 Decoder 模块删掉。输出头需要训练，不能把现有 LLM 的输出层随意替换就得到 Jev；这也不能证明其实际推理只需一次前向计算。

（以上内容，应用开发的同学看不懂算了。抓住最核心的就行：**推测Jev也是基于Transformer结构做的，但是网络改变了自回归生成形式，不用循环生成，而是一次预测最终的概率**。）

###### 7.3.2.2.2 后训练：RLCD 与 RLHF 有什么不同？

**Jev 的核心训练方向是 RLCD（Reinforcement Learning for Calibrated Decisions），即“面向校准决策的强化学习”。** 它的重点不只是让模型选对答案，还要让输出概率准确表达不确定性，便于软件据此做决策。

我们熟悉的 **RLHF（Reinforcement Learning from Human Feedback）**，通常先收集人类对不同回答的偏好，再通过奖励模型等方式指导策略优化，使回答更有帮助、更符合人的要求。**RLCD 则把优化重心放在决策结果和概率校准上：不仅问“选得对不对”，还问“给出的概率是否可信”。** 前者侧重人类偏好反馈，后者强调校准目标，两者并非互斥，也不能简单理解为 RLCD 完全不使用人类反馈。

**RLCD 最值得关注的创新方向，是把后训练的重点从“人更喜欢哪个回答”，转向“软件能否依据预测概率采取行动”。** 例如，程序可以结合误判成本，决定自动处理还是转交人工。不过，其具体奖励函数、训练数据和策略更新算法尚未公开；目前能明确的是训练目标，不能把它写成已知的完整算法，也不能由此推导出“零错误”或“零幻觉”。

---

###### 7.3.2.3 使用方式：分类路由与工作流节点预测

下面的两种模式是**应用架构模式**，不是 Jev 提供的两个独立产品。

###### 7.3.2.3.1 模式一：先分类，再交给合适的大模型处理

这一模式把 Jev 放在较昂贵的生成或推理步骤之前。

```Plain Text
用户请求 / 邮件 / 内容
        ↓
Jev：分类、评估复杂度、识别处理要求
        ↓
策略代码：选处理分支与模型
        ↓
便宜模型 / 强推理模型 / 专用工具 / 人工审核
        ↓
生成回答或执行任务

```

![图片展示了Jev处理邮件的流程。Jev先判断邮件类别，再通过代码拨动路由，进入不同下游处理队列。若为FAQ，由轻量模型处理；若为分析，由强推理模型处理；若不明确，则由人工接手。图片与上下文紧密相关，直观呈现了文档中提到的Jev模式一先分类再交给合适大模型处理的流程，帮助理解其工作原理。](05_模型选型与路由_images/B-B39/NWKnbUvIRoVtMvxnLKWcQtzYnRf.png)

*动图 4：跟随编号 1、2、3 的邮件，观察它们如何在路由处分道，进入不同下游。颜色之外也保留编号和终点标签；实际分支由代码策略控制，Jev 不自动拥有执行权限。*

典型例子是客服：

- 简单 FAQ → 经过验证的知识库检索与轻量生成流程；
- 账务争议 → 账务专用流程，需要时由更强模型整理证据；
- 明确要求人工 → 进入人工队列；
- 无法可靠判断 → 回退到更强模型、澄清或人工。

也可以让 Jev 在一个工具目录中选择候选工具，再由下游组件构造参数。**工具选择不是完整 function calling**：选择 `refund_lookup`，并不等于已正确提取 `order_id`、完成鉴权或调用工具。

###### 7.3.2.3.2 模式二：提前编排工作流，只在关键节点让模型预测

这一模式由开发者规定状态与流转规则，Jev 负责原本难以用纯规则完成的语义判断。

```Plain Text
新工单 → 补齐上下文 → Jev 分类 → 代码路由
                              ↓
                  查账 / 收集证据 / 提交人工
                              ↓
                      通用模型起草回复
                              ↓
                  Jev 检查语气、覆盖度等
                              ↓
              硬规则校验 + 权限检查 + 审批策略
                              ↓
                      发出回复 / 退回处理

```

![图片展示了Jev模型在处理同一份工单时，沿固定路径前进的流程。从工单开始，经Jev分流、LLM起草，再到Jev检查，若检查未通过则需修改，之后还需经过策略门才能发送。该图与上下文紧密相关，直观呈现了文档中提到的模式二：提前编排工作流，只在关键节点让模型预测的流程，帮助理解Jev在软件快速概率决策中的工作方式。](05_模型选型与路由_images/B-B39/NYNibeMQgoBpxnxT7E5cJdT4nFf.png)

*动图 5：同一份文档沿固定路径前进，第一次检查未通过时退回修改，之后仍需经过独立策略门才能发送。回退路线由程序预先设计，不是 Jev 自己生成工作流；模型检查也不是完整安全保证。*

“分类—路由—生成—检查”的设计可以覆盖识别退款诉求、紧急程度、客户情绪，以及检查回复是否回应问题、是否泄露内部规定等节点。

与通用自主 Agent 的主要区别是：

**预先编排的工作流 + Jev**由开发者定义允许的状态与转换，模型只负责当前节点的具体判断。其可控性来自显式策略、类型、权限和状态机，适合稳定、重复、结果空间可定义的任务。

**开放式 Agent**则可能由模型动态形成计划和路径，并承担规划、选工具、构造参数、解释结果等职责。它依赖 Agent 框架、工具约束和运行时治理来保持可控，更适合路径难以事先穷举的探索性任务。

**我相信这个对我设计项目是一个新的启发，之前我们很多人设计的项目都有，**用一个主Agent做思考，判断，分类给不同的Agent去做。现在我们可以思考的一点，用一个Agent(LLM) 去做一个简单的分类任务，是不是从速度，成本，准确性上都不如Jev模型，是属于大炮打蚊子。我们是否可以在我们的架构设计中，使用Jev来做这种分类的决策？

---

###### 7.3.2.4 面试问题

###### 7.3.2.4.1 最近很火的 Jev 模型你看了吗？谈谈你的理解。

💡 **答题思路**  
从**Jev是什么（模型）**，相比于普通LLM的**核心和特点**（设计理念，速度，花费）对比，对我们的**设计启发**（对于很多分类，判断，评分问题可以用Jev，而不用llm)

📝 **参考答案**

看过相关资料。我的理解是，Jev 是一个面向软件自动化的决策模型，不是另一个聊天模型。它主要解决分类、是非判断和评分问题，比如工单该交给哪个部门、邮件是否紧急。它的重点不是写一段回答，而是根据预先定义的问题，输出程序可以直接使用的判断结果和概率。

它和通用 LLM 的区别，我觉得主要在优化目标。通用 LLM 强调生成、推理和开放式任务，Jev 则专注高频、结果范围明确的小决策，追求更低的延迟和调用成本。传统 LLM 当然也能分类，但只是判断一封邮件的类别，就调用昂贵的推理模型，可能没有必要。

它给我们带来的分工思路：简单的语义分类、判断和评分，可以考虑交给 Jev；复杂分析和内容生成，仍然交给通用模型。这个思想可能会对我们的工作模式，项目设计会带来很大的改变，今后可能会大量运用在我们的生活中。

###### 7.3.2.4.2 Jev 模型对于你的工作有什么启发？

💡 **答题思路**  
可以从项目设计的角度来回答一下，之前没有Jev的时候，我们的设计：会思考确定性的东西用代码来做，不确定的东西用llm做。现在设计项目我们可以从三点出发：**什么时候用代码做，什么时候用jev做，什么时候用Llm做**，以及再谈谈上面讲到的jev的两种使用方法。

📝 **参考答案**

它对我最大的启发，是项目设计时可以把任务分得更细。以前我们常说，确定性的逻辑用代码，不确定的语义问题交给 LLM。现在我会进一步区分：需要理解语义，但答案范围明确的任务，不一定要用通用大模型。

具体来说，**规则校验、计算和权限控制，优先用代码**；**工单分类、紧急程度判断、内容评分，可以考虑 Jev**；**复杂推理、方案规划和回复生成，仍然交给 LLM**。不是为了用新模型而增加组件，而是给每个任务选择合适的实现方式。

在用法上，我会考虑两个方向。**第一是前置路由**，让 Jev 先判断请求类型和复杂度，再由代码把请求分给轻量模型、强推理模型或人工，避免所有请求都调用最贵的模型。**第二是在预先编排的工作流里承担局部判断，**比如客服流程中，先判断诉求和紧急程度，再由 LLM 起草回复，最后用 Jev 检查回复是否覆盖问题、语气是否合适。真正发送仍由代码和审批规则控制。

这两种方式可以组合。我的核心思路是把判断、生成和执行分开，再用业务评测验证收益；对于不确定或高风险的结果，保留人工复核。

###### 7.3.2.4 讲解视频

https://www.bilibili.com/video/BV15zah6fEWq/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

## 6. 模型训练与后训练

### 1.1 LLM是如何被训练出来的

**1. 构建基础模型（构建通用大模型）**

- **预训练（Pre-training，非监督）**

  - 使用海量的通用、未标注数据（如网页、书籍、代码等）。
  - 目标是让模型具备**语言理解、推理、世界知识**等通用能力。
- **微调（SFT）**

  - 使用**指令-响应数据**、任务特定数据、人工标注数据。
  - 让模型学会**遵循指令**，更贴近实际应用。
- **对齐（如 RLHF、DPO）**

  - 基于**人类偏好数据**，通过奖励模型或偏好分数进行优化。
  - 目的是让模型输出更符合人类价值观和安全要求。

**2. 微调基础模型（提升指定场景性能）**

- 从通用 LLM/SLM 出发，模型已经具备：      

  - **语言能力、推理能力、世界知识、聊天、指令跟随、代码能力**等。
- 再次进行： 

  - **微调（SFT）**：针对特定领域或任务的数据。
  - **对齐（RLHF、DPO）**：确保输出符合特定用户或行业需求。
- 最终得到**针对特定场景优化的模型**。

### 1.2 Function calling是如何被训练出来的

Function calling是通过在模型训练的**预训练阶段**使用**自监督学习**，在**微调阶段**使用**SFT技术**，以及在**对齐阶段**使用**RLHF技术**来使模型具有能够理解用户意图并生成函数结构化的函数调用请求的能力。

具体来讲：

预训练阶段的自监督学习使得模型能够理解自然语言。

微调阶段的SFT技术使用标注数据让模型理解何时该调用函数，调用函数的格式是什么。

对齐阶段使用RLHF，使用人类的反馈来优化调用结果，使模型的调用更符合人类的习惯。

## 7. 模型与硬件

### **6.1 模型能不能跑**

> 这个章节其实涉及的内容也很复杂，涉及训练，推理。要是都弄得特别透彻的话，需要结合具体的算法来计算，需要理解神经网络的结构，训练过程，具体的算法。如果没有深度学习背景，算法基础，推理的基础，肯定看不懂所有的细节，不过你可以抓大放小，细节你都放掉，掌握具体的原则即可。你看我总结的面试问题和回答示例的时候，也没有回答特别多的细节。如果还在学习应用的朋友，**抓大放小，忽略细节**。如果学习了算法，有推理，训练的基础，可以对细节看得更仔细。另外本期内容也配备了视频讲解，可以结合来看。 另外这一小节的内容其实有非常多的算法，推理部署相关的东西，还是按照我们的思路来说，第一阶段的核心任务是学好应用，这里的内容对于应用岗位属于**拔高项和加分项**，优先级低于应用相关知识。

>  这里讲清楚一个模型能不能跑起来，核心就是一个问题：**运行它的设备内存够不够**。 

>  如果模型跑在 GPU 上，这个设备内存通常就是显存；如果跑在 CPU 上，就是内存（RAM）。同一个 7B 参数的模型，推理时可能只需要 14GB 左右设备内存，而用 PPO 做强化学习对齐时可能需要超过 200GB。所以在回答"需要多少内存/显存"之前，我们必须先搞清楚：**现在是哪个阶段、跑在哪类设备上**。

#### **6.1.1 背景：先搞清楚"问的是哪个阶段"**

当有人问"训练一个大模型需要多少内存/显存"时，这个问题就过于笼统，缺少了细节—因为一个大模型从诞生到被用户使用，要经历多个完全不同的阶段，每个阶段的内存需求差异极大。同一个 7B 参数的模型，推理时可能只需要 14GB 左右设备内存，而用 PPO 做强化学习对齐时可能需要超过 200GB。所以在回答"需要多少内存/显存"之前，我们必须先搞清楚：**面试官说的是哪个阶段、跑在哪类设备上**。所以第一部分，给大家介绍一下大模型的生命周期。大模型的生命周期，也是建议大家需要理解和掌握的，虽然大家的岗位和工作可能只聚焦在一块，但是你需要知道他整个生命周期。

##### **6.1.1.1 大模型完整生命周期**

> 掌握这个图也可以看出大模型的大致岗位。 一般说算法，Infra, 算法工程，说的其实比较笼统，那对应会的事就是这里的RLHF（后训练），或者做模型部署推理的。 大模型应用工程 不处于这个图中，而是使用部署好的模型接口，直接调用，在上层做应用。 当然大模型算法一部分，就是搞研究，读论文，修改数理公式，创新个RL的方法呀，让整个训练效果更好，这种要求就会更高，一般要求论文，顶级学历（c9 硕博）。
> 
> 综上，大模型方向岗位的门槛一般是  算法（纯研究) > 算法工程、infra,推理 > 大模型应用

![这张图片展示了大语言模型的生命周期流程，流程分为五个阶段依次推进，由蓝色箭头串联：第一阶段是预训练，对应任务为基于海量语料的下一个词预测；第二阶段是监督微调，采用人工标注的prompt与响应对进行调整；第三阶段为奖励模型训练，依据人类偏好对比进行；第四阶段是强化学习相关的策略更新，采用PPO或GRPO优化；第五阶段为部署与推理，面向用户和应用提供服务。其中，第三、四阶段共同构成强化学习（RL），而第二至第四阶段的流程整合形成RLHF，即基于人类反馈的强化学习，是提升模型效果的核心环节，与文档中提及的大模型算法相关内容相呼应。](07_模型与硬件_images/B-模型与硬件（显存/算/XNS5bNf5eonvmbxhMTdcjb4sn7c.png)

**1. 预训练**

这是大模型的"出生"阶段。用海量文本数据（几万亿 token）训练模型预测下一个 token，让模型学会语言规律、世界知识和推理能力。这个阶段由 OpenAI、Meta、DeepSeek 等顶级团队完成，成本动辄数百万美元，普通人和工程师直接下载现成的 Base Model 即可，无需自己做。

**2. SFT**

Base Model 只会"续写文本"，不会"回答问题"。SFT 用人工标注的（问题, 高质量回答）数据对，教会模型遵循指令、按格式输出。这是让模型从"自动补全"变成"AI 助手"的关键一步。

**3. 奖励模型训练**

收集人类对不同回答的偏好数据（"A 回答比 B 好"），训练一个打分模型。这个模型之后会充当"AI 评委"，给策略模型的输出打分，替代人类实时反馈。

**4. 策略更新**

用强化学习算法（PPO 或 GRPO）驱动模型不断优化，目标是在奖励模型认可的方向上提升输出质量，同时不偏离 SFT 模型太远（通过 KL 惩罚控制）。这才是严格意义上的"RLHF"中的 RL 部分。

**5. 部署推理**

训练完成后，模型被部署给用户使用。这个阶段不需要梯度和优化器状态，运行内存需求大幅下降。如果部署在 GPU 上，主要看的就是显存；如果部署在 CPU 上，主要看的就是内存（RAM）。可以通过量化（INT8、INT4）进一步压缩，让模型跑在消费级显卡或普通 CPU 机器上。

#### **6.1.2 基础知识铺垫**

##### **6.1.2.1 核心原则**

**运行内存需求 = 运行设备上每样东西的大小之和。**

所以搞清楚两件事就够了：**放什么** + **每样多大**。

> 这里的"运行设备"可以是 GPU、CPU，也可以是 NPU/TPU 等加速器。跑在 GPU 上时，这部分内存通常叫**显存**；跑在 CPU 上时，就是**内存（RAM）**；跑在其他加速器上，则更准确地叫**设备内存**。后文为了讲解方便，很多地方仍会用"显存"举例，但底层计算逻辑是一致的。

在讲"放什么"之前，先明确**两个阶段**在干什么：

\- **训练阶段**：典型的深度学习训练过程——前向传播计算 loss，反向传播计算梯度，优化器用梯度更新参数。因为要做反向传播，计算设备必须同时持有参数、梯度、优化器状态，还要缓存中间激活值，所以内存压力极大；如果用 GPU 训练，这个压力就体现为显存压力。

\- **推理阶段**：模型已经训练好，只做前向传播，输入 prompt 输出 token。不需要更新任何参数，因此梯度和优化器状态完全不存在，运行内存需求大幅下降。

这也是为什么同一个模型，训练和推理的运行内存需求可以相差 5-10 倍。

##### **6.1.2.2 训练 vs 推理：运行内存里住着什么？**

```Plain Text
┌─────────────────────────────┐      ┌─────────────────────────────┐
│          训练阶段            │      │          推理阶段            │
├─────────────────────────────┤      ├─────────────────────────────┤
│  ✅ 模型参数                 │      │  ✅ 模型参数                 │
│  ✅ 梯度                    │      │  ❌ 梯度（不需要）            │
│  ✅ 优化器状态               │      │  ❌ 优化器状态（不需要）      │
│  ✅ 激活值（前向传播缓存）    │      │  ❌ 激活值（不需要缓存）      │
│  ❌ KV Cache（通常不涉及）   │      │  ✅ KV Cache                 │
└─────────────────────────────┘      └─────────────────────────────┘
       训练内存占用：参数量 × ~14字节 + 激活值    推理内存占用：参数 + KV Cache
```

推理比训练省内存的根本原因：**梯度和优化器状态消失了**，这两项在训练时占了总内存的大头；如果模型跑在 GPU 上，这里说的总内存就是总显存。

##### **6.1.2.3 各部分简介**

**训练和推理都有**

**模型参数（Parameters）**

模型的"权重"，就是神经网络里所有的数字。7B 模型 = 70亿个参数。训练和推理都需要，是运行内存占用的基础项，也是估算一切的起点。

---

**训练专属（推理时全部消失）**

**梯度（Gradients）**

反向传播时计算出来的"每个参数应该往哪个方向调整多少"。每次更新完参数就可以释放，但在反向传播过程中必须常驻运行内存。精度通常用 fp32（4字节），大小和参数量相同。

**优化器状态（Optimizer States）**

优化器（如 Adam）为了更稳定地更新参数，需要记录每个参数的历史梯度信息（动量 m 和方差 v）。Adam 需要存两份，共 8字节/参数，是训练运行内存开销最大的单项。与梯度不同，优化器状态跨训练步骤**全程持久存在**。

**激活值（Activations）**

前向传播时每一层的中间计算结果。反向传播计算梯度时需要用到它，所以前向传播过程中必须缓存。大小与 batch size 和序列长度成正比。可用"梯度检查点"技术，在反向传播时重新计算激活值而非缓存，以计算时间换内存空间。

总结上述内容，可以用下面的图来表示

```Plain Text
前向传播                    反向传播                  参数更新
───────────────────────────────────────────────────────────────▶
产生激活值（缓存）  →  用激活值计算梯度  →  优化器用梯度更新参数
    ↑                      ↑
 占内存，撑到              占内存，用完即丢
 反向传播结束才能释放
```

![图片展示了神经网络训练过程，分为前向传播和反向传播两个阶段。前向传播中，输入数据经输入层、隐藏层、输出层，计算损失；反向传播中，损失反向传播至各层，更新权重。右侧是GPU内存结构，包含模型参数、梯度、优化器状态、激活值等。图片与上下文紧密相关，直观呈现了文档中提及的“梯度检查点”技术在反向传播时重新计算激活值而非缓存，以计算时间换内存空间的原理。](07_模型与硬件_images/B-模型与硬件（显存/算/LPwwbqjNdoc4n4xo7f8c8V79nbc.png)

---

**推理专属**

**KV Cache**

KV Cache可以理解为推理时一个空间换时间的策略。推理时，模型自回归生成每个新 token 都需要"回顾"之前所有 token 的注意力键值（Key-Value）。KV Cache 把这些中间结果缓存下来，避免每步都重新计算。随上下文长度和并发请求数增长，长上下文或高并发场景下不可忽视。

##### **6.1.2.4 精度与字节数**

> 混合精度训练：刻意将低精度（bf16/fp16）和高精度（fp32）混合使用——在能省的地方用低精度（前向传播、反向传播计算，节省显存和加速），在必须保精度的地方用高精度（梯度存储、参数更新，防止数值不稳定）。
> 
> 这里在**面试网龙的时候也被问过，面试官问bf16和fp16的区别。**

这里的“精度”决定了每个参数、梯度或中间激活值用多少字节存储。字节数越低，显存占用越小、吞吐通常越高；但数值范围和有效精度也会下降，训练时更容易遇到溢出、下溢或更新不稳定。因此训练常用混合精度：参数和计算尽量用 bf16/fp16，梯度累积、优化器状态等关键部分保留 fp32。

- **fp32（4 字节）**：精度高、数值稳定，但显存占用最大、计算吞吐较低。常用于**梯度、优化器状态、关键累积计算**。
- **bf16（2 字节）**：和 fp32 接近的数值范围，不易溢出；有效精度低于 fp32。**大模型训练的常用选择**，覆盖训练参数、前向反向计算、推理。
- **fp16（2 字节）**：有效精度比 bf16 略高，但数值范围更小，训练易溢出，常需 loss scaling。多用于**推理、混合精度训练、较老 GPU 加速**。
- **INT8（1 字节）**：量化压缩，显存更省，但带来少量精度损失。用于**量化推理**。
- **INT4（0.5 字节）**：压缩最激进，显存占用最低，但对模型效果和量化方法更敏感。用于**极致压缩推理、QLoRA**。

##### **6.1.2.5 激活值大小的计算**

> 激活值的大小计算就比较复杂了，和超参数，数据量，模型结构都有关系。大家如果看不懂很正常，缺少算法基础，还是像我们前头说的原则，抓大放小，我下面也总结了激活值大小大概的估算方法。看不懂先有大概印象就行。

激活值不像参数一样固定，它由四个变量共同决定：

- **B（batch size）**：一次喂多少条数据 — 超参数，可调。
- **L（sequence length）**：每条数据有多少个 token — 由数据集和截断设置决定，部分可控。
- **H（hidden dimension）**：模型隐藏层维度 — 模型架构决定，选定后固定。
- **N（层数）**：Transformer 的层数 — 模型架构决定，选定后固定。

**粗略公式（bf16，每一层）：**

$$\text{单层激活值} = B \times L \times H \times 10 \sim 12 \text{ 字节}$$

$$\text{全模型激活值} = B \times L \times H \times N \times 10 \sim 12 \text{ 字节}$$

> 这里的 10\~12 字节是经验系数，不是数学常数。不同框架、是否使用 FlashAttention、是否开启梯度检查点，都会影响真实激活值大小。它适合作为视频讲解里的快速估算。

**7B 模型举例**（\$H=4096\$，\$N=32\$）：

- **B=1, L=2048**：约 **2.5 GB**
- **B=4, L=2048**：约 **10 GB**
- **B=8, L=2048**：约 **20 GB**
- **B=4, L=8192**（长文本）：约 **40 GB**

**快速估算口诀（不想算细节时）：**

> 7B 模型，batch=4，seq=2048 → 激活值约 **10 GB。**seq 翻倍 → 激活值翻倍；batch 翻倍 → 激活值翻倍

---

#### **6.1.3 后训练阶段**

后训练的每个算法，在显存里放的东西不同，需要按统一假设分别估算。下面统一用 **7B 模型、混合精度（bf16 参数 + fp32 梯度/优化器）** 作为基准。

> **基础换算**：7B 参数
> 
> 参数（bf16）：7B × 2字节 = **14 GB**
> 
> 梯度（fp32）：7B × 4字节 = **28 GB**
> 
> 优化器状态 Adam（fp32，动量+方差）：7B × 4字节 × 2 = **56 GB**
> 
> 激活值：随 batch size 和 seq_len 变化，下面各节单独说明
> 
> 注意：这里“梯度”和“优化器状态”都按 fp32 存，但数量不同：梯度只有一份，所以是 4字节/参数；Adam 优化器状态有动量 m 和方差 v 两份 fp32，所以是 2 × 4 = 8字节/参数。

##### **6.1.3.1 SFT — 全参微调（Full Fine-Tuning）**

**显存里有什么：**

所有参数都参与训练，梯度和优化器状态覆盖全部 7B 参数。

- **模型参数（bf16）**：7B × 2 字节 = **14 GB**
- **梯度（fp32）**：7B × 4 字节 = **28 GB**
- **优化器状态 Adam（fp32）**：7B × 4 字节 × 2 = **56 GB**
- **激活值**：B·L·H·N·12 字节，典型 **10–40 GB**

**激活值典型范围**（7B，\$H=4096\$，\$N=32\$，bf16）：

- B=4，L=2048 → 约 10 GB
- B=8，L=2048 → 约 20 GB
- B=4，L=8192（长文本）→ 约 40 GB

**结论**：固定项已达 98 GB，单张 A100（80GB）仅凭固定项就装不下，必须多卡或开启梯度检查点。

##### **6.1.3.2 SFT — LoRA 微调**

**核心思路**：冻结原始模型参数，只在每层注入小的低秩矩阵（rank r，通常 r=8\~64），只训练这些新增的 adapter 参数。

**LoRA 可训练参数量估算**（r=16，7B 模型约 32 层，每层注入 Q/V 矩阵）：

- 每个 adapter：2 × (hidden_dim × r) ≈ 2 × (4096 × 16) ≈ 13万参数

\- 全模型 adapter 总量 ≈ 约 **4000万参数（0.04B）**，仅占原模型的 0.5%

7B 模型 SFT LoRA 微调显存拆解（LoRA 参数量按 \~0.04B 估）：

- **原始模型参数（bf16，冻结、无梯度）**：7B × 2 字节 = **14 GB**
- **LoRA 参数梯度（fp32）**：0.04B × 4 字节 ≈ **0.16 GB**
- **LoRA 优化器状态 Adam（fp32）**：0.04B × 4 字节 × 2 ≈ **0.32 GB**
- **激活值**（同全参）：B·L·H·N·12 字节，典型 **2.5–10 GB**

**激活值典型范围**（7B，\$H=4096\$，\$N=32\$，bf16）：

- B=1，L=2048 → 约 2.5 GB
- B=4，L=2048 → 约 10 GB

> 注意：LoRA 的激活值和全参 SFT **近似同量级**——因为前向传播时整个模型都要跑，激活值覆盖全部 32 层，不会因为"只训练少量参数"就消失。真实工程里可能通过冻结层优化、梯度检查点进一步降低。

**结论**：单张 4090（24GB）在短序列、小 batch 下可以跑 LoRA，但比较贴边；更常见的消费级方案是 QLoRA（把冻结的底座模型量化存储）。显存大幅下降的原因是**梯度和优化器状态只覆盖极少量 adapter 参数**，而不是全部 7B。

##### **6.1.3.3 RL 对齐 — PPO 算法**

> 这里涉及到强化学习的两个算法，PPO和GRPO。没有强化学习的背景肯定看不懂，可以先理解或者背诵。 如果想要学习强化学习，可以用零基础学习算法章节的后训练SKILL去学习，这个SKILL主要核心就是在讲解这两个算法和区别。

**PPO 需要同时在显存里维护多个模型**（这里按最容易理解的"独立 Actor + 独立 Critic + Reference + Reward Model"估算）：

**PPO 同时持有 4 个 7B 模型，显存压力极大：**

- **Actor 策略模型**（生成回答，训练目标）— **训练中**：参数 + 梯度 + 优化器 + 激活值，**108–138 GB**
- **Critic 价值网络**（估计每个状态价值，辅助计算优势）— **训练中**：同 Actor，**108–138 GB**
- **Reference Model**（SFT 冻结版，计算 KL 惩罚）— **冻结**：仅参数，**14 GB**
- **Reward Model**（给回答打分）— **冻结**：仅参数，**14 GB**

**合计 ≈ (108\~138) + (108\~138) + 14 + 14 ≈ 244\~304 GB**

**为什么需要 Critic？**

PPO 用 GAE（广义优势估计）计算每个 token 的优势值，需要一个能输出 $V(s)$（状态价值）的网络，这个 Critic 网络和 Actor 同等规模。

**结论**：7B PPO 通常至少 4 张 A100 80GB 起步，并且需要分片、梯度检查点等工程优化，是后训练中显存开销最大的算法。

##### **6.1.3.4 RL 对齐 — GRPO 算法（DeepSeek R1 方案）**

**GRPO 的核心改动**：去掉 Critic，改用"组内相对奖励"估计优势——同一个 prompt 生成 G 条回答，用组内均值做 baseline，不需要价值网络。

GRPO 相对 PPO **去掉了 Critic**，是 R1 训练得以可行的关键优化. **GRPO 需要的模型**：

- **Actor 策略模型**（生成回答，训练目标）— **训练中**：**108–138 GB**
- **Reference Model**（计算 KL 惩罚）— **冻结**：仅参数，**14 GB**
- **Reward Model**（规则函数可替代）— **可选**：**0–14 GB**

**合计 ≈ 122–152 GB**，相比 PPO 节省了一个完整 Critic（≈100 GB），算力门槛下降了一档。

**合计 ≈ (108\~138) + 14 ≈ 122\~152 GB**（不用独立 RM 的情况）

**额外注意**：GRPO 每个 prompt 要采样 G 条回答（通常 G=8），激活值比普通 SFT 更大，实际偏向范围上限。

**对比 PPO 的节省：**

- 去掉 Critic：直接省去一整个训练中的模型（108\~138 GB）
- 去掉 Reward Model（用规则打分）：再省 14 GB

\- **显存从 \~244\~304 GB 降到 \~122\~152 GB，减少约一半**

**结论**：7B GRPO 单张 A100 80GB 无法完成（122\~152GB > 80GB），通常至少需要 2 张 A100 起步，并配合分片或梯度检查点；相比 PPO 的 244\~304GB，显存压力大约减半。这是 DeepSeek R1 选择 GRPO 的核心工程原因之一。

---

#### **6.1.4 部署推理阶段**

推理阶段只做前向传播，没有反向传播，因此**梯度、优化器状态、训练用的激活值缓存全部消失**。主要显存开销只剩两样东西：模型参数 + KV Cache（实际框架还会有少量临时 workspace）。

##### **6.1.4.1 模型参数：精度决定基础显存**

推理时参数可以用比训练更低的精度，进一步压缩显存。

**7B 模型各精度下的参数显存：**

- **bf16 / fp16（2 字节）**：**14 GB**，标准推理，效果无损。
- **INT8（1 字节）**：**7 GB**，量化推理，效果略有损失。
- **INT4（0.5 字节）**：理论 **3.5 GB**，实际常见 **4–5 GB**（因为还要存量化 scale 等元数据），极致压缩。

> **量化**：将参数从高精度（bf16）映射到低精度（INT8/INT4）存储，推理时动态还原计算。显存减半，但精度有损失，模型越大量化损失越小（70B模型 INT4 通常还可接受，7B INT4 可能有明显退化）。

##### **6.1.4.2 KV Cache：随上下文增长的动态开销**

> 这里面公式又很复杂，需要专门做过部署推理的人才会深入理解，还是抓大放小，有个印象就行。

推理时每生成一个 token，都需要回顾之前所有 token 的注意力键值（Key-Value）。KV Cache 把这些结果缓存起来避免重复计算（空间换时间）。

**KV Cache 大小公式：**

$$\text{KV Cache} = 2 \times B \times L \times N \times N_{kv\_heads} \times D_{head} \times \text{字节数}$$

- 系数 2：Key 和 Value 各一份
- $B$：当前同时参与推理的序列数，也可以叫推理时的有效 batch size；在线服务里通常可近似理解为“正在生成中的活跃并发请求数”
- $L$：上下文长度（已生成的 token 数）
- $N$：层数
- $N_{kv\_heads}$：KV 头数量
- $D_{head}$：每个注意力头的维度

> 如果是传统 MHA，KV 头数量通常等于注意力头数量，KV Cache 会更大；如果是 GQA/MQA，KV 头数量更少，KV Cache 会明显变小。所以 KV Cache 也和模型结构有关。

**7B 模型举例**（\$N=32\$，\$D\_{head}=128\$，bf16，按 8\~32 个 KV 头给范围）：

KV Cache 的显存几乎与 `batch × context_length` 成正比：

- **B=1, L=2048**：约 **0.25–1 GB**
- **B=1, L=32K**：约 **4–16 GB**
- **B=16, L=2048**：约 **4–16 GB**
- **B=16, L=32K**：约 **64–256 GB**（多并发 + 长上下文是显存炸裂的典型场景）

> 长上下文 + 高并发时，KV Cache 可以轻易超过模型参数本身的显存占用，这是部署时最容易被忽视的显存杀手。

##### **6.1.4.3 推理总显存 = 参数 + KV Cache**

**7B 模型典型推理场景：**

推理总显存 = 模型参数 + KV Cache，5 个典型场景：

1. **单用户短对话（bf16）**：14 GB 参数 + 0.25–1 GB KV ≈ **14.25–15 GB**，4090 单卡可跑。
2. **单用户长上下文 32K（bf16）**：14 GB + 4–16 GB ≈ **18–30 GB**，4090 视模型结构而定。
3. **量化单用户（INT4）**：4–5 GB + 0.25–1 GB ≈ **4.5–6 GB**，消费级卡轻松。
4. **多并发 16 路、短对话（bf16）**：14 GB + 4–16 GB ≈ **18–30 GB**，A100/80G。
5. **多并发 16 路、长上下文（bf16）**：14 GB + **64–256 GB** ≈ **78–270 GB**，必须多卡或限流。

---

#### **6.1.5 汇总对比表**

> 以下均以 **7B 模型、混合精度（bf16 参数 + fp32 梯度/优化器）** 为基准。训练激活值按 10\~40GB 估算；推理 KV Cache 按 8\~32 个 KV 头给范围

- **SFT 全参微调**：**108–138 GB**（参数 14 + 梯度 28 + Adam 56 + 激活 10–40）
- **SFT LoRA**：**17–25 GB**（冻结参数 14 + adapter 梯度&优化器 ≈0.5 + 激活 2.5–10）
- **RL PPO**：**244–304 GB**（Actor 108–138 + Critic 108–138 + Ref 14 + RM 14）
- **RL GRPO**：**122–152 GB**（Actor 108–138 + Ref 14，去掉 Critic）
- **推理 bf16，单用户**：**14.25–15 GB**（参数 14 + KV 0.25–1）
- **推理 bf16，16 并发 / 2048**：**18–30 GB**（参数 14 + KV 4–16）
- **推理 INT4，单用户**：**4.5–6 GB**（参数 4–5 + KV 0.25–1）

---

#### **6.1.6 附：根据显卡选方案**

我们在选卡时，应该自己用上面的知识去算一下，给一个表让大家有个直观印象。

- **消费级 4090（24 GB）**：7B bf16 推理；7B QLoRA / LoRA 微调（控制 batch、seq_len）；30B 级 INT4 量化推理。
- **专业卡 A100（80 GB）**：7B LoRA 微调较轻松；7B 全参 SFT 单卡不够；7B GRPO 通常需要 2 张起步。
- **多卡 A100 × 4（320 GB）**：7B 全参 SFT / GRPO 较稳；7B PPO 可做，但需要分片、梯度检查点等工程优化。
- **多卡 H100 × 8（640 GB）**：7B PPO 较稳；70B 级全参训练通常还需要 ZeRO、并行切分、梯度检查点或优化器状态压缩。

---

#### **6.1.7 附：面试 Q&A**

> 其实面试过程中很多时候对于类似的问题，面试官本身的表述是模糊的。比如6.1.7.1， 问SFT要多大显存？但是SFT里有全量微调，Lora等部分参数微调，算法不一样，结果是不一样的。回答问题的时候，我们自己心里要是清楚的，主动澄清清楚前提和具体细节，然后给面试官举例说明，可以不用说得那么细致，说一下大致的估算即可。如果面试官深入问了，可以再给他讲细节，也就是我们上面笔记介绍的细节部分

##### **6.1.7.1 Q1：7B 模型做 SFT 大概需要多大显存？**

这个问题要先看是**全参 SFT**还是 **LoRA/QLoRA**。原则上，训练显存主要由参数、梯度、优化器状态和激活值组成。

如果是全参 SFT，通常会按照业界大模型训练里常见的**混合精度训练口径**来估算：模型参数用 bf16/fp16 存储，梯度和 Adam 优化器状态保留 fp32。这个口径的来源其实就是不同精度的字节数：7B 参数用 bf16/fp16 是 2 字节/参数，所以参数本身约 14GB；梯度按 fp32 是 4 字节/参数，所以约 28GB；Adam 还要保存一阶动量和二阶动量两份 fp32 状态，所以是 2 × 28GB，约 56GB。再加上激活值，全参 SFT 通常要 **100GB 以上**，单张 80GB A100 一般不够，需要多卡或分片优化。

如果是 LoRA/QLoRA，因为只训练少量 adapter 参数，梯度和优化器状态会小很多。以 7B 为例，LoRA 通常 **20GB 左右**可以起步，QLoRA 会更省，消费级 24GB 显卡也有机会跑起来，但要控制 batch size 和 sequence length。

##### **6.1.7.2 Q2：7B 模型做强化学习大概需要多大显存？**

强化学习阶段要看具体算法，因为不同算法需要同时放进显存的模型数量不一样

如果以 PPO 为例，通常要同时维护 Actor、Critic、Reference Model 和 Reward Model。Actor 和 Critic 都是训练中的完整模型，单个就接近全参微调的开销，所以 7B PPO 往往需要 **200GB 以上显存**，通常需要多张 A100/H100，并配合 ZeRO、梯度检查点等工程优化。

如果以 GRPO 为例，它去掉了 Critic，用组内相对奖励来估计优势，显存压力会明显下降。7B GRPO 大致可以按 Actor + Reference Model 来估，通常在 **100GB 以上**，相比 PPO 大约省一半，但单张 80GB A100 仍然比较紧张。

##### **6.1.7.3 Q3：7B 模型部署推理大概需要多大显存？**

部署推理和训练不一样，推理不需要梯度和优化器状态，主要看两个东西：**模型参数**和 **KV Cache**。

如果用 bf16/fp16 推理，7B 模型参数大约是 **14GB**。KV Cache 的大小差异会比较大，主要和上下文长度、并发请求数、模型的注意力结构以及 KV Cache 本身的存储精度有关。单用户、短上下文场景下，再加少量 KV Cache，整体大约 **15GB 左右**，24GB 显卡一般可以跑。

如果做量化，INT8 大约 7GB，INT4 实际常见大约 4\~5GB，再加 KV Cache，可以进一步降低显存。但如果是长上下文或高并发，KV Cache 会快速增长，这时显存瓶颈可能不再是模型参数，而是 KV Cache。

##### **6.1.7.4 Q4：你说在CPU机器上跑7B的模型，这个可以跑得动吗？**

> 这个是阿里夸克千问一面面试官的原题。我当时被问到这个问题，其实我答得很笼统，我就说模型比较小，也做了量化。但当我学习了今天这个内容以后，我才总结出这个更细致，详实的答案。当然当时我的回答也并没有阻碍我通过面试，反正整个夸克千问我是拿到了offer的。我们都会按照100分甚至是120的回答去准备，但是通过一次面试，不意味着面试每个问题都要回答到100分。
> 
> 另外，其实我分析来说，其实当时的面试官我估计也不懂这个细节。原因是本身就是应用岗，夸克千问整体面试下来给我的感觉，他们这个岗位不会做算法，不做训练，纯专注于应用，强度又高，其实面试官不知道这块内容很正常。他问到这个问题，是因为项目写了在cpu机器上本地跑7B模型。所以我答得模糊这事也就过去了。不过在这种情况下，当时我能够像下面这个答案一样回答得很具体，甚至面试官感兴趣，继续问我，我给他讲一下，这样面试会更加分。如果在面试官不懂的地方，你能够给他讲得很清楚，会极大地加分。

可以跑，但要分两个角度看：**能不能装下**，以及**跑得快不快**

首先从能不能装下看，CPU 机器没有 GPU 显存，主要看的是**内存（RAM）够不够**。这里我按实际使用场景来回答：我把 7B 模型量化成了 **INT4**，并且使用 **llama.cpp** 做 CPU 推理。

推理阶段的内存主要是：**量化后的模型参数 + KV Cache + llama.cpp 运行时开销**。7B 模型做 INT4 量化后，模型文件通常大约 **4\~5GB**。KV Cache 的大小和上下文长度、并发数有关，但本地 CPU 推理一般是单用户、单路对话，也就是并发数基本可以按 **1** 来算。如果上下文长度是 2K\~4K，7B 模型的 KV Cache 通常大约是 **0.5\~2GB** 这个量级，具体取决于模型结构和 llama.cpp 的 KV Cache 精度设置。再加上系统和框架开销，整体大概需要 **8\~10GB 内存**，所以 16GB 内存的普通消费级机器一般可以跑起来，8GB 会比较紧张。

其次从速度看，CPU 可以跑，但速度和 GPU 不是一个量级。INT4 量化会减少模型参数读取和计算压力，llama.cpp 又专门针对 CPU 做了优化，比如多线程、矩阵计算优化、GGUF 格式加载等。按普通消费级 CPU 来估算，一次普通长度的回答大概可能在 **20\~30 秒左右**；另外考虑到我们的任务对实时性要求不高，所以这个时延是完全可以接受的。

#### 6.1.8 视频讲解

本小节的内容涉及范围很广，算法，部署，深度学习，大家可能学起来有难度。我录了一个视频，视频的讲解面向于0基础，相信大家都能看懂。

https://www.bilibili.com/video/BV1Lb5S6qEuA/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

### 6.2 跑的有多快

跑的有多快，相对来说更复杂：取决于你的算力和任务。

**核心原则：**算力越强，并行度越高 -> 越快。

影响因素：

├── 硬件算力（ 每秒浮点运算次数，好的显卡，cpu 算力更强，速度也更快）

├── 内存带宽（数据搬运速度）

├── 并行度（多核/多卡）

└── 软件优化（推理框架）

└── 任务类型（任务复杂，prompt 和 时间复杂度成o(n^2）关系（从Attention结构上来讲））

其实这个问题相对来说就更加复杂，在《大模型工程师面试实战- 算法原理，开发实践与系统部署》（清华大学出版社） 书中是有专门讲解这个推理速度相关的问题，以及如何优化。这个和硬件，Infra的岗位相关，是他们优化的工作。所以具体还是很复杂的，但是作为应用，我们了解到这里就可以啦！

## 8. 微调基础

### 8.1 SFT的方案有哪些？

参考《从零构建大模型 – 算法，训练与微调》第5章

从大的方向上可以分为**全量微调**和**部分参数微调**。

**全量微调**是比较传统的方法，对模型所有的参数都进行训练，适应性强，适合复杂任务，但是成本高，计算资源消耗大，容易过拟合。

目前在llm模型领域使用更多的是只需训练部分参数的微调。比如说：

通过在模型结构中**插入新的模块**来实现微调的方法，例如：Adapter tuning, LoRA, QLoRA，他们不改变原始参数，只训练新模块，适用于中大型任务。

通过在**输入前添加可训练的提示**或**前缀来引导模型**的方法，例如Prompt Tuning和 P-Tuning等，他们不改变模型结构，参数极少，适用于轻量任务或快速迭代。

#### 8.1.1 简单介绍Lora技术

Lora原理就像拼图。 整个模型的参数就是一幅完整的拼图，而LoRA微调的目标是只调整几个特定的拼图模块，而不重拼整个模块。

具体来说，LoRA通过低秩分解将大矩阵拆分成两个小矩阵，只微调这两个小矩阵中的参数，不改变整个大的权重矩阵。

这种分解相当于把复杂的工作分配给几个辅助部件来完成，既保持了原模型的稳定性，又能够用较少的参数适应新的任务。

此外，LoRA只需要微调小矩阵中的少量参数，因此减少了计算量和存储需求，适合快速迭代和部署。

 

#### 8.1.2 **Lora中的常见参数**

**模型参数**

r (秩）：

（概念）控制低秩矩阵的大小，影响训练参数量和模型容量。

（作用）r 越大，模型能学习到更多任务特征，但显存占用也会增加。

（常用范围） 4 \~64，典型配置是r = 16 或 8。简单任务用8，复杂任务用16\~32

alpha(缩放因子）

（概念） 用于缩放LoRA权重的影响。

（作用）调节LoRA插入模块对原始模型的影响速度，通常为r 的 1\~2倍。

（常用范围）16 \~ 128。

target_modules

（概念）指定在哪些层插入LoRA。

  (作用）影响训练效率和效果，通常选择注意力层。

**训练参数**

（训练参数放在Lora下似乎不太准确，但是因为问的最多的就是Lora，笔记部分暂时也没涉及别的方法的模型训练，所以我先放在这里）

**learning_rate（学习率）**

- 控制权重更新速度
- **作用**：太高会导致不收敛，太低训练慢。
- **常用范围**：学习率通常设置在一个较低的范围 （1e-4 \~ 5e-5）。

**batch_size（批大小）**

- 每次训练处理的样本数。
- **作用**：影响显存占用和训练稳定性。

**epochs（训练轮数）**

- 完整遍历数据集的次数。
- **作用**：轮数太少模型学不够，太多可能过拟合。
- **常用范围**：一般设置在3\~5轮，防止过拟合。

#### 8.1.3 简单介绍Prompt Tuning技术？

Prompt Tuning是一种通过调整输入提示来引导模型更准确地理解任务的微调方式。在Prompt Tuning中，模型的权重保持不变，微调仅涉及对输入提示进行优化。通过精心设计Prompt，模型可以在任务上下文中生成更精准的输出，可以提升对特定任务的表现。这种方式不仅高效，还可以适应不同任务，使得大模型不需要大规模微调就能适应新的任务需求。

 

#### 8.1.4 你是怎么做的微调？

（这也是一个**比较常考**的问题，这个答案也是我参考了一些资料和自己项目总结的一个暂时比较满意的答案）

首先按照这个4个思路来讲解：

（1） 确定目标/做好选型

      （2） 数据集的准备

      （3） 确定参数，进行微调，部署

      （4） 验证和评估

   按照这个思路，面试官会觉得你逻辑非常清晰，做法非常规范。 在这个思路下，再添加自己的项目细节。让答案更加丰满，以下以我的项目，按照上述思路进行回答，请大家自己根据实际情况参考。 

我的答案是根据这个笔记总结的，如果你需要总结自己的答案，强烈建议阅读这个：https://www.xiaohongshu.com/explore/692c36e1000000001b02120e?app_platform=ios&app_version=9.19.5&share_from_user_hidden=true&xsec_source=app_share&type=normal&xsec_token=CBab5PFDvzdmqER5g7jT9IzuPt7ZOmgeEnLQ3UclYMWIk=&author_share=1&xhsshare=WeixinSession&shareRedId=ODgyNUdJSk42NzUyOTgwNjczOTdINzlO&apptime=1772294660&share_id=77829c9f62674574b9a7e6de1910ac19

）

我认为做微调是一个非常严谨的，数据驱动的科学实验过程。 在微调的过程中，我们通常有4个步骤：1.确定目标/做好选型。 2.数据集准备。 3. 确定参数，平台，进行微调。 4.验证和评估。

**1.** **首先是确定好目标，做好选型**，比如是否可以通过提示词工程 或者 RAG 技术来解决，这样成本更低。同时考虑一些硬件是否支持，比如16GB显存，可以使用LoRA 微调，如果是13B模型，可能就要使用QLoRA。在我的系统中，核心目标是将模型压缩，同时保留模型的精度，使用的是远端Azure AI Foundry， 训练的是Qwen2.5-7B-Instruct，使用的是LoRA技术。

**2.** **数据集的准备。**项目采用**真实用户邮件标注样本**、**GPT-4生成的合成数据**，以及**Enron Email Dataset公开数据**集，共500条样本。在准备好数据后，做了一些文本标准化，敏感信息去除的数据前处理。

**3.确定LoRa的参数， r(秩），alpha 缩放因子 以及一些超参数**，比如**学习率**，**Batch Size**, **训练轮数**，我们的任务比较简单r，就设置较小值8， 相应的alpha就是r的两倍16.**。** LoRa只训练部分参数，因此可以稍微设高学习率，这里采用的2e-4.

除此之外，在训练中密切监测训练集和验证集的损失曲线。如果验证集损失持续上升而训练集损失持续下降，说明可能出现了一些过拟合，可以采取**早停** 增加数据正则化等。 在训练结束后使用PEFT库将适配器权重和基础模型合并。

**4.**对于不同的任务，可以使用不同的评估方法。比如分类任务 可以用：**F1-Score方法**， 文本生成任务可以用：**BLEU/ROUGE。** 通用对话任务，可以使用业内公认的基准比如：**MT-Bench** 来获得一个可以比较的分数。在我的项目中，由于该任务属于**结构化信息提取**任务，需要从自然语言邮件中准确提取并转换为JSON格式的事件信息，简单来说是采用的是字段级别F1-Score结合精确匹配的评估方法。简单来说即对每个字段（如title、时间、地点）分别计算准确率，既保证整体结构正确，又允许语义相同但表达不同的情况。

### 8.2 强化学习的方案有哪些？

（先背一下基本概念，实际中考察的并不多，所以不深入学习）

**1. 基于人类偏好的 RL**

- **RLHF（Reinforcement Learning with Human Feedback）**

  - **奖励来源**：人类排序数据 → 奖励模型。
  - **优化方式**：PPO（Proximal Policy Optimization）+ KL Penalty。
  - **目标**：对齐人类偏好、安全和价值观。
  - **代表模型**：ChatGPT、Claude。

**2. 基于 AI 偏好的 RL**

- **RLAIF（Reinforcement Learning with AI Feedback）**

  - **奖励来源**：强大教师模型（如 GPT-4）生成偏好排序。
  - **优化方式**：同 RLHF（PPO）。
  - **目标**：降低人工标注成本。
  - **代表模型**：Anthropic 的 Constitutional AI。

**3. 基于偏好数据的直接优化**

- **DPO（Direct Preference Optimization）**

  - **奖励来源**：偏好数据（人类或 AI）。
  - **优化方式**：直接优化策略，不训练奖励模型。
  - **目标**：简化 RLHF，避免 PPO 的复杂性。
  - **代表模型**：LLaMA-2-Chat、Mistral-Instruct。

### 8.3 SFT和RLHF的区别是什么？

（问的并不是特别多，作为强化学习的基础知识先准备着）

**目标上的区别**：SFT的目标是让大模型能**有基本的语言能力和执行任务的能力**，RLHF倾向于让大模型的回答更符合**人类偏好**，**安全**和**价值观**。

**方法上的区别**：SFT使用**有监督**的方式训练，数据集的形式是问题-答案。而RLHF采用**强化学习**的方式，**数据集**是包含多个答案，以及**答案的排序**和**奖惩模型**的。

**步骤上的区别**：RLHF通常是在SFT的基础上进行进一步优化的。

 

### 8.4 数据集的准备

（数据集的准备也是面试官很常考的一个问题，我这里这一节4.1介绍了一些常见的数据集的来源，4.2 介绍了对数据进行前处理的方法。请大家根据4.1和4.2 整理出自己的针对于面试官问 "你的项目/LoRa是如何制作数据集的" 这一问题的回答。另外4.3是DeepSeekR1 的训练方法，里面包含了一些数据集制作思路，如果有什么契机你能把这个流程给面试官讲，一定会很加分）

#### 8.4.1 常见的数据集来源

微调领域常见的数据集的来源：

1.内部数据：从一些内部的文档，或者用户使用的数据来去做标注。

2.公开数据：寻找一些已经存在的数据库，比如Hugging Face Datasets，Enron Email Dataset 。

3.人工标注：费时，但是可以得到高精度的定制化数据。

4.数据合成：数据合成，利用大模型去生成。

#### 8.4.2 数据清洗和前处理

1.文本标准化：将文本统一大小写，去除一些特殊字符，html tags之类的。（虽然现在模型可能对大小写理解得很好，但是你统一大小写会降低模型学习难度）

2. 敏感信息去除：去除一些敏感信息，比如用户的名字，电话号码。（主要是合规性考虑）

3. 平衡数据：平衡一些数据集类型的占比，特别是分类任务，避免某一类内容过多。

4. 标签纠正：避免一些数据集矛盾的问题。（比如同一个输入，有的分类成angry,有的分类成frustrated, 那么选择一个label或者合并种类）

5. 统一格式：对于不同的微调任务，需要的输入格式可能会不一样。比如分类任务的格式是{Text->Label}, 问答任务的格式是：{Context, Question -> Answer}

#### 8.4.3 DeepSeek R1 训练方法

（参考资料 https://zhuanlan.zhihu.com/p/24621463668，作为一个**拔高知识点**，这个题大概率不是面试官直接问的，但是如果你能够在某个契机能把这个讲出来，就会比较加分。从DeepSeekR1训练方法去理解 整个模型 SFT + 强化学习 + 训练集的准备的整个过程。理解整个过程，可以给面试官讲清楚 训练过程 + 谈谈自己对这套方法的理解。一定会加分。 大概这么吹牛逼： 我看了DeepSeekR1的训练，它的大概的训练步骤是xx(笔记部分训练过程）。通过这篇论文和训练方法，我的启发是（笔记部分训练背后蕴含的思想）xx）

![图片展示了DeepSeek R1训练方法流程。从DeepSeek v3 base模型出发，通过向DeepSeek - R1 - Zero提问并人工精修，生成数千条思维链监督数据集，用于有监督微调SFT。再经GRPO强化学习，得到监督微调 + 强化学习后的模型，通过拒绝采样得到DeepSeek v3。接着整合80万SFT数据，进行有监督微调，结合奖励信号和多样化全场景强化学习，最终得到DeepSeek R1模型。该图与文档中介绍的DeepSeek R1训练方法内容相契合，直观呈现了训练过程。](08_微调基础_images/B-微调基础（SFT/R/BKcWblDzSoqg5Xx1P2icJUKHnsg.png)

**训练过程：**

1. 通过向DeepSeek-R1-Zero 提问，再通过人工精修，生成几千条思维链监督数据集。
2. 使用生成的几千条思维链监督数据集，训练DeepSeek v3 base模型，得到思维链监督微调后的模型。
3. 使用GRPO强化学习，奖励分数引入准确率和语言一致性分数，得到强化学习训练后的模型。
4. 使用强化学习训练后的模型，采用拒绝采样方法，收集60万条思维链推理数据集，其中拒绝采样的奖励模型使用DeepSeek-v3。
5. 向DeepSeek-v3提问和整理DeepSeek-v3训练数据集，得到20万条写作、事实问答和自我认知等领域的非推理数据，滤掉了混合语言的链式思考、长段落和代码块。并整合60万条思维链推理数据集。得到一个80万监督数据集。
6. 使用80万监督数据集训练DeepSeek v3 base模型，再做多样化强化学习，最终得到DeepSeekR1模型。

**背后的蕴含思想：**

**一：闭环迭代，不是一次性训练：**

      不是 "先准备数据 ->一次性训练模型", 而是：训练模型->用更强的模型生成更好的数据-> 再训练->模型更强->再生成数据。 这种闭环让模型和数据共同进化，避免低质量数据拖后腿。

**二：数据质量优先：**

通过拒绝采样，人工精修，模型奖励打分，确保训练集干净，逻辑正确。

**三：分阶段训练：**

阶段1：SFT -> 学会遵循指令

      阶段2: GRPO 强化学习->优化推理能力

      阶段3：多场景RL-> 提高泛化和安全性

**四：多类型数据集，能力互补**

**指令遵循数据集** 让模型可以听懂指令。

       **推理链数据集**：让模型逐步推理 

      **非推理任务数据集**：保持通用能力。

**奖励信号数据集**：强化输出质量

#### 8.4.4 面试问题精选

4.4.1 判断数据是否值得训练？

判断一批数据值不值得训练，我会看几个标准：

**是否真实覆盖业务问题**

数据要来自真实高频、高价值、容易出错的场景。比如用户天天问、模型经常答错、RAG 很难靠检索解决的问题，这种才值得训。

如果只是一些泛泛的知识问答，模型本来就会，训练价值就不大。

**是否有明确可学习的模式**

微调适合学习的是稳定的输出风格、任务格式、领域表达、工具调用方式、拒答边界、分类标准、结构化抽取规则。

如果问题本质是“知识不够新”或者“答案依赖外部文档”，那更适合 RAG，不适合靠微调硬记。

**标签质量够不够高**

训练数据里答案要正确、一致、无歧义。

如果同一个问题在不同样本里答案互相冲突，或者标注人标准不统一，模型训练后会更不稳定。微调不是洗数据的魔法，脏数据只会放大问题。

**是否能覆盖失败案例**

很有价值的数据往往来自 badcase：模型曾经答错、拒答错、格式错、工具调错、幻觉的样本。

这些数据经过修正后，可以让模型学会“原来这种场景应该这样处理”。

**是否和现有能力有增量**

如果基础模型已经能很好完成，或者靠 prompt 就能稳定解决，那没必要微调。

只有当 prompt 太长、规则太复杂、输出不稳定、某类任务反复失败时，微调才更有收益。

**是否能被评测验证**

训练前最好留出一批验证集，看微调后在准确率、格式遵循率、拒答准确率、工具调用成功率、用户满意度上有没有提升。

如果没有评测集，就很容易变成“感觉模型更好了”，但其实可能只是对训练集过拟合。

精选自 [202604 腾讯AIAgent暑期实习一面](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)

---

## 9. 推理加速

### **9.1 常见的推理加速方法**

我们可以从**模型层面**，**硬件层面** 和**系统架构**层面 三个方向入手：

**A 模型层面**

**1.模型量化**： 将FP32 转换成INT8 或更低的精度，减少计算量和内存占用，一般这样推理速度可以提升2\~4倍。

**2.模型剪枝**：删除冗余权重或者不重要的神经元，减少参数。

**3.知识蒸馏：**用大模型训练一个小模型，部署时用小模型推理。

**B 硬件层面**

**1.** **GPU/TPU 加速**： 使用高性能GPU 或专用AI 芯片。

**2.** **多卡并行**：将模型分布到多个GPU上进行计算。

**C 系统架构层面**

**KV 缓存**：对Transformer的注意力计算进行缓存，在长文本推理时加速效果显著。

**FlashAttention:**  一种针对Transformer的注意力计算的高效实现方法，可以显著减少内存占用并提升计算速度，特别适用长序列推理场景。

### 9.2 蒸馏

模型蒸馏是一种**模型压缩和知识迁移技术**，主要用于将一个复杂、性能强大的模型（通常称为“教师模型”）的知识传递给一个**更小、更高效**的模型（称为“学生模型”）。它的核心目标是**在保持模型精度的同时降低计算成本和存储需求。**

具体做法是把教师模型的**输出作为额外的监督**  和**学生模型的输出**做对比，通过优化损失函数来训练学生模型。

**为什么要做模型蒸馏？**

**部署需求**：大型模型在移动端、嵌入式设备或低算力环境中难以运行。

**推理速度**：小模型推理更快，适合实时应用。

**节省资源**：减少内存占用和能耗。

**具体做法**

在训练过程中，教师模型会输出对每个数据的预测分布，这些分布包含了每个类别的概率，就像老师教学生做选择题的时候，不仅会给出正确答案，也会标注出其它选项为什么不正确。 

随后通过知识蒸馏，学生模型使用教师模型的软标签来进行学习。这个过程包含两个目标：一是让学生模型学会在分类任务上给出准确的答案，二是模仿教师模型的预测分布，尽量让自己的输出和教师模型相似，这样可以让学生模型在不增加参数的情况下更快，更好地学习到知识，在实际应用中也能更高效运行。

### **9.3** 量化

#### 9.3.1 常见量化方法

**训练后量化（PTQ, Post-Training Quantization）**

- **特点**：在模型训练完成后，将浮点权重和激活转换为低精度（如 INT8）。
- **优点**：实现简单，计算成本低。
- **缺点**：没有在训练过程中考虑量化误差，精度可能下降明显，尤其是对复杂模型。

**量化感知训练（QAT, Quantization-Aware Training）**

- **特点**：在训练过程中模拟量化操作（如插入伪量化节点），让模型在训练时“感知”量化带来的误差。
- **优点**：精度接近浮点模型，因为训练过程考虑了量化。
- **缺点**：训练成本高，需要从头训练或至少进行完整的训练周期。

**量化感知微调（QAF, Quantization-Aware Fine-tuning）**

- **特点**：不是从零开始训练，而是基于一个 **预训练模型**，在微调阶段加入量化感知操作。
- **优点**：比 QAT 成本低，因为只需要微调而不是全量训练。
- **缺点**：精度可能略低于完整 QAT，但通常比 PTQ 好很多。

#### 9.3.2 量化的好处和坏处

（小红书面试官问过，算是基本概念题，简单理解背诵下）

**好处**

**降低计算和存储成本**

- 将 FP32 转换为 INT8 或更低精度，可以显著减少**内存占用**和带宽需求，提升推理速度，降低能耗，尤其适用于边缘设备和移动端。

**支持大模型在有限硬件上运行**

- 例如 QLoRA 技术通过 4-bit 量化，使 650 亿参数的大模型可以在单张 48GB GPU 上微调，保持接近原始性能。 

**降低部署成本**

- 在生产环境中，量化可以减少硬件资源需求，降低整体运营成本，提升模型的可扩展性

**坏处：**

**精度下降**

- 低精度表示范围有限，可能导致**权重和激活值的细微差异被放大。**这会导致：模型在分类、预测等任务上可能出现轻微性能损失，尤其是对数值敏感的任务，性能下降比较明显。

**累积误差**

- 在深层网络中，量化误差会逐层累积，影响最终输出，尤其在**注意力机制或归一化等算子中表现明显**。这会导致模型在复杂推理任务中表现明显下降。

### 9.4 剪枝

去除神经网络里不重要的连接或者神经元。可以减少模型参数，提升推理速度，对于移动和嵌入式设备友好，因为去掉了冗余信息，可以降低过拟合的风险，提高泛化能力。缺点是精度损失问题。不同的模型和硬件对于剪枝的适应程度也不同。

#### 9.4.1 常见的剪枝方法

非结构化剪枝：随机移除单个权重或者连接，压缩比大，但是对于推理速度提升不大。

结构化剪枝：按照一定规则，比如移除整个神经元，滤波器或者层，更加适合硬件加速。

### 9.5 二值化

极端的量化技术，它把神经网络的权重和激活值限制在了两个值上，通常是+1, -1。

### 9.6 模型压缩技术的选择

在极端资源受限的场景下，二值化和量化是优先考虑的技术。

二值化适合精度不高的任务，量化可以调整压缩精度，在压缩效果和模型性能之间找到平衡。

如果更加注重计算效率，希望显著提升模型的推理速度，同时对模型精度还有一定要求，那么量化和结构化剪枝是不错的选择。

如果目标是在保持模型性能的前提下进行压缩，那么知识蒸馏就是理想之选。

### **9.7 常见的推理框架**

（在说到熟悉推理这块，面试官很可能会问你熟悉哪些推理引擎，最好都有一个了解，结合你用的引擎深入了解）

![图片是一张表格，对比了vLLM、Llama.cpp、FasterTransformer、DeepSpeed - Inference、ONNX Runtime等5个推理框架的核心特点、量化支持、硬件支持及适用场景。如vLLM高效且兼容HuggingFace，Llama.cpp超轻量、支持4 - bit/8 - bit量化，FasterTransformer针对Transformer优化等。表格直观呈现各框架的特性，与上下文介绍推理框架的内容相契合，帮助读者快速了解各框架的适用场景及优势。](09_推理加速_images/B-推理加速（量化/蒸馏/WjtSbd2Qnofk3hx4dp7c1Jlgnqb.png)

#### 9.7.1 为什么Llama.cpp 的在cpu上效果更好？

（因为我的项目使用了Llama.cpp 替代了 onnx runtime, 在cpu上对于同一模型推理速度提升了1倍以上，所以面试官可能会问我这个问题，这个问题更多是根据我个人情况准备的，供大家参考。大家也可以结合自己的情况，自己用了什么推理加速来准备一些相似问题。）

1. **内核优化**：llama.cpp 针对 LLM 做了高度融合的算子（注意力、RoPE、KV cache），减少框架调度和内存拷贝；ONNX Runtime是通用框架，算子分发和调度开销更大。
2. **线程与缓存策略**：llama.cpp会主动优化线程亲和、NUMA绑定、缓存布局，KV cache访问更高效；ORT默认设置如果没调优，容易出现带宽瓶颈。
3. **指令集利用**：llama.cpp直接用AVX2/AVX-512等SIMD指令，针对矩阵乘法和量化内核做了手工优化；ORT依赖通用库，优化程度不如专用实现。

**一句话总结**：即使模型和量化相同，llama.cpp在CPU上更快，是因为它是专门为LLM推理做极致优化的，而ONNX Runtime是通用框架，调度和内存管理开销更大

**7.2 介绍一下vLLM 框架**

（vLLM 框架在很多岗位的jd 上都写着有要求，今天平安证券也问到了这个，不过亲测这个问题问的不多，倾向于咱们先背个基本概念就好。我从三个方面总结了， 设计**思路，特点，总结，**如果问到可以选择性地和面试官介绍）

 **1. 设计思路**

vLLM 的核心目标是解决 **大语言模型推理的高并发和显存瓶颈问题**。传统推理框架在处理长上下文或多请求时，KV 缓存占用显存过大且容易碎片化，导致性能下降。  
 vLLM 的设计理念是通过 **PagedAttention** 技术，将 KV 缓存分页管理，类似操作系统的虚拟内存分页机制，**显存复用率高**，适合长上下文和多请求场景，从而实现**高效的显存利用和动态批处理**。

**2. 特点**

PagedAttention技术： 将kv缓存按页管理，避免显存碎片化，支持灵活调度。 **显存复用率高，支持长上下文和多请求场景。**

动态批处理：异步调度器可以将不同请求合并，提高GPU利用率，降低延迟。

高兼容性：支持HuggingFace Transformers模型，几乎无需修改代码即可接入。

      分布式推理：支持多GPU，多节点部署，适合大规模服务。

**3.** **总结**

vLLM的核心创新是PagedAttention + 动态批处理。解决了传统推理框架在显存管理和并发处理上的痛点，显著提升吞吐量和资源利用率。相比于其它框架，vLLM 更适合 **在线高并发推理，**尤其在长上下文和显存受限的情况下表现突出。

### 9.8 你的项目是如何做推理加速的？

（ 这个问题是我给面试官准备好的，我的项目中是如何使用 **LoRa + 强化学习DPO + 量化 + 推理，来完成将Qwen2.5-7B-Instruct 模型 适配在CPU 电脑上，极大降低推理延迟，提升推理速度，并且提升任务质量的**。 

    这个问题几乎是所有我所学的关于模型推理加速/微调这两部分的内容 在 我的项目中运用的实际体现。  这个问题答案供大家参考，如果你想要向面试官展示你有 模型微调/推理加速的经验，你也要准备一个你自己对这个问题的回答，讲清楚 在你的项目中，背景是什么，用了什么技术，怎么使用，为什么要使用，最终达到了什么效果。）

我负责优化邮件日历事件提取的模型性能。**背景是**用户需要从邮件快速创建日程，但云端API延迟2-3秒且按调用计费，不适合高频场景。**我的方案是**本地部署微调后的开源模型Qwen2.5-7B-Instruct，通过三步优化实现性能和成本的平衡。

**第一步是LoRA微调，**使用**PEFT库**实现低秩适应，只训练0.18%参数（1400万 vs 76亿），将任务准确率从基础模型的65%提升到92%。选**择LoRA而非全量微调是基于成本和效率考虑，能够显著降低显存需求和训练时间**，同时保持接近全量微调的效果。训练数据来源包括：**真实用户邮件标注样本、GPT-4生成的合成数据，以及Enron Email Dataset公开数据集**，共500条样本，在Azure AI Foundry上训练完成。

**第二步是DPO对齐，**使用**TRL库**的Direct Preference Optimization进一步优化输出质量。构建了200对'chosen-rejected'偏好数据：chosen样本来自人工标注的高质量输出，**rejected样本通过规则扰动（添加冗余字段、格式错误、信息缺失）生成**，**并混合了少量GPT-4生成的负样本**。在LoRA基础上训练1小时，将JSON格式规范性从85%提升到98%，显著减少了解析错误和冗余输出**。**

**第三步是量化部署**，这里做了技术选型：对比了ONNX Runtime、PyTorch Mobile和llama.cpp三个方案。最终选择llama.cpp是因为它CPU推理做了深度优化，包括**SIMD并行计算**和**内存管理优化**，比ONNX快2.5倍。量化使用`torch.ao.quantization` 库，方案采用Q4_K_M混合精度Post-Training Quantization：Attention层保持5-bit精度，FFN层压缩到4-bit，输出层用6-bit确保质量。最终模型从14GB压缩到4.3GB，推理速度从154秒降到43.7秒，提升3.5倍，同时准确率只损失2.5%（92%→89.5%），在可接受范围内。

**这个项目的价值**在于：通过参数高效微调（LoRA）和训练后量化（PTQ）的组合，在不牺牲太多精度的前提下，将云端依赖转为本地部署，成本从按次计费降为零边际成本，同时满足了实时响应需求。技术选型上，llama.cpp在CPU推理上的性能优势是关键决策点，使得无GPU环境也能高效运行7B模型。

### 9.9 参考资料

模型压缩四大方法概述 | 量化、剪枝、蒸馏和二值化 

推荐理由：特别适合快速了解这四个技术，是干什么的，怎么做，有哪些常见方法，不深入讲解公式和原理，小白也能听懂。

https://www.youtube.com/watch?v=jW2cmZ-9hLk

---
