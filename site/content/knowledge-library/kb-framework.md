# 开源框架解读

> **模块**：12_开源框架解读/12_开源框架解读.md  
> **构成**：4 个知识点合为一篇，按顺序编号  
> **规模**：约 3,459 行  |  **生成**：2026-11-12

## 目录

1. PI-Agent
2. Hermes
3. ClaudeCode源码解读
4. DeepSeekRuntime

---

## 1. PI-Agent

### **5.1 总述**

#### **5.1.1 Pi 是什么,**

Pi 是一个很小的、可以自我扩展的 Agent Harness，也就是 Agent 运行框架。它的产品口号是 "grows with you"。直白一点说，就是先给你一个很小的内核，后面缺什么再加什么。

刚装好的 Pi 很克制：默认只有 4 个工具，分别是 `read`、`bash`、`edit`、`write`；系统提示词大约 20 行；没有 MCP，没有子代理，没有权限弹窗，没有 plan 模式，也没有内置 todo。第一次看会觉得功能少，但这正是它的设计选择：内核只保留必要部分，其他能力通过扩展补上。你缺一个能力，就可以让 Pi 写一个 TypeScript 扩展把它接进去。

Pi 是 TypeScript monorepo，主要由 4 个 package 组成：

\- **pi-ai**：多供应商 LLM API 抽象，覆盖 OpenAI、Anthropic、Google、Bedrock 等。

\- **pi-agent-core**：Agent 运行时，包含工具调用、状态管理、会话和压缩。

\- **pi-coding-agent**：面向编码场景的交互式 CLI。

\- **pi-tui**：自研终端 UI 库，支持差分渲染。

##### **5.1.2 Pi 与 Claude Code 的主要区别**

Pi 选择"小内核加扩展"，Claude Code 选择"默认带齐常用功能"。这个差异会影响工具数量、权限模型、提示词长度、扩展方式和会话结构。下面按维度对比，每条都先说 Pi、再说 Claude Code：

![该图片展示了Pi与Claude Code两款工具的核心维度对比，契合上下文对二者差异的说明需求。对比维度涵盖设计哲学、默认工具数、系统提示词、权限系统等内容：Pi采用“小内核加扩展”模式，设计哲学为极简内核、缺什么再加，默认仅4个工具，系统提示词短，权限系统默认无、依赖容器/沙箱，仅提供TypeScript扩展可选，会话存储采用JSONL append-only加parent指针构建，仅回退对话无需改代码，无内置长期记忆机制，Agent loop从零手写；Claude Code则是“默认带齐常用功能”模式，开箱即用且内置常用能力，默认有十几个常用工具加30+内置工具，系统提示词较长含大量规则，有内置权限确认加沙箱，多种能力内置，会话存储同样为对应指针构建，需对话+代码一起回滚，有内置memory与CLAUDE.md，Agent loop为自有实现。](01_PI-Agent_images/B-开源框架解读：PI-/QmP2bGlZbodLvNxCvROcZSs7nVm.png)

##### **5.1.3 为什么 Pi 适合学习**

我认为这个项目特别适合，你在学完Agent理论之后，第一个学习的实践项目。不论你是想要阅读开源代码，还是说找一个项目改装，扩展，这个项目都太合适了。

Pi 是一个很合适的样本。原因主要有四个：

1. 内核小，能读完。Claude Code 这类功能密集的工具，新手容易迷失在边缘功能里。Pi 的主干就是 agent loop，入口集中，读起来更容易抓住脉络。别看他小，但他五脏俱全。基本上面试Agent岗位的时候，围绕记忆，压缩，会话恢复，Agent Loop(React)这些是面试最常考的点，这些都有。即使他不算很复杂，但是你学会了以后，对于一个Coding Agent整体的架构的意识思想是完备的。
2. Agent loop 是手写的。市面上有 OpenAI Agents SDK、Vercel AI SDK 这类框架，导入后很快就能跑，但很多关键步骤被封装起来了。Pi 把初始化、压缩、模型调用和工具循环都写在明面上，更适合学习。
3. 模块边界清楚。4 个 package 各管一块，内核和交互层分开。Agent Core 可以脱离终端，被 RPC 或 SDK 调用，所以读一层时不必同时理解所有 UI 细节。
4. 他的思想"grows with you"，太适合你去改造了，添加了。比如他没有Plan功能，没有MCP功能。都适合你一边用，一边学，一边改造和扩展。

---

#### **5.2 结构速览**

并知道接下来应该读哪几块。安装和日常使用细节不展开，官方视频里讲得更细

##### **5.2.1 仓库结构速览**

```Plain Text
packages/
├── ai/            # pi-ai：多供应商 LLM 抽象，providers/ 下一家一个文件
├── agent/         # pi-agent-core：agent loop、harness、session、compaction
├── coding-agent/  # pi-coding-agent：CLI 入口、工具实现、扩展系统、交互模式
└── tui/           # pi-tui：通用终端 UI 组件库（Box / Text / List / Markdown…）
```

四个包，按"两类角色"来记最省事：

**产品本体：coding-agent。** 你在终端敲的 \`pi\` 命令，入口就是它（它的 \`package.json\` 里 \`bin.pi\` 指向 \`dist/cli.js\`）。它自己几乎不造轮子，而是把另外三个包装配起来用：要智能就用 \`agent\`，要画界面就用 \`tui\`，要连大模型最终落到 \`ai\`。

**被它使用的三个库：** \`agent\`（agent loop 与会话）、\`tui\`（终端 UI 组件）、\`ai\`（LLM 抽象，最底层）。

依赖方向只有一个朝向，记牢它能省掉很多困惑。下面箭头表示"谁 import 谁"：

```Plain Text
coding-agent ─┬─→ agent ─→ ai
              └─→ tui
```

`coding-agent` 同时依赖 `agent` 和 `tui`；`agent` 再依赖 `ai`；而 `ai` 和 `tui` 是两个"叶子"——除了各自的外部 SDK，它们不依赖任何内部包，也都不知道 agent 的存在。

![图片展示了PI-Agent的结构速览。上方是`coding-agent`，其依赖`agent`和`tui`，`agent`依赖`ai`，`ai`和`tui`是“叶子”，不依赖其他包。下方有`agent`、`ai`、`tui`三个模块，`ai`依赖`LLM 抽象/多 provider`，`tui`是通用终端UI组件库。图片下方说明所有箭头都从依赖方指向被依赖方，不存在反向依赖或循环依赖，与上下文介绍的依赖方向一致。](01_PI-Agent_images/B-开源框架解读：PI-/Ce0abfBKyoXqDTxZUzich5Tsnzc.png)

---

#### **5.3 架构**

这一章回答"Pi 由哪些部分组成"。不按模块清单平铺，而是顺着数据流走一遍：你敲下回车后，一条消息经过哪些部件，最后怎么变成 Agent 的回复。

##### **5.3.1 架构总览**

这一节是整章的地图。先给一张全局视角，把后面 3.2 到 3.9 串成一条线，之后每一节再单独展开其中一站。这里只关心运行时这些部件怎么协作；各部件分属哪个 package、谁依赖谁，2.2 已经讲过，不再重复。

你在终端敲下一句话、按回车，到屏幕上一个字一个字冒出回复，中间大致经过这几站：

1. **CLI 入口（3.7）**：唯一的入口就是 \`pi\` 这个命令。它启动时先解析配置、加载扩展、建好会话，然后根据"现在是终端还是管道、带没带参数"**选一种运行模式**，再把消息交给 agent loop。模式有三种——交互界面（interactive，默认的 TUI 聊天）、一次性打印（print，\`pi "你的问题"\`，打印完就退，接近传统 CLI）、程序化后端（RPC，给别的程序当后端）。入口只有一个，这三种只是它之后的不同运行形态，细节见 3.7。

2. **Agent Loop（3.2）是中枢，而且下面 3 到 7 这些事都发生在它的一轮循环之内。** 一轮里它依次：组装上下文 → 检查要不要压缩 → 调用模型 → 看模型要不要调工具 → 把这一轮产生的东西写进会话。换句话说，"调用 LLM""执行工具""写 Session"不是 loop 之外的独立步骤，而是 loop 在一轮里亲自做的几件事。

3. **Context 组装（3.3）**：把系统提示词、AGENTS.md、skills 描述、工具描述、历史消息和你这次的输入，拼成一份完整上下文。模型本身没有记忆，每一轮都要重新喂。

4. **Compaction 检查（3.6）**：上下文要是太长，就先让模型把历史总结成摘要。注意这一步也会**往会话文件 append 一条"压缩"节点**——摘要本身也是会话树里的一个条目，之后取上下文时用它替换掉被压缩的那段历史。

5. **调用模型（3.9）**：通过 \`pi-ai\` 把上下文发给当前选中的 provider（OpenAI / Anthropic / Google…）。对 loop 来说，换模型只是换一个 provider，主流程不变。

6. **工具循环（3.4）**：模型若要调 \`read\`/\`bash\`/\`edit\`/\`write\`，loop 就执行工具、把结果回灌给模型；模型可能接着调，也可能收尾。读写代码、跑命令，真正发生在这一步。

7. **写入会话（3.5）**：这不是循环跑完才做的收尾，而是**边跑边写**——每产生一条消息（你的输入、模型回复、每个工具结果）、每做一次压缩，都立即按"只追加 + 父指针"往 JSONL 文件追加一行；只有换模型、改工具集这类配置变更，才推迟到一轮结束时统一写。所有这些条目靠 \`parentId\` 串成那棵可回退、可分叉的会话树。

8. **TUI 渲染（3.8）**：整个过程中，loop 不断广播事件，终端界面订阅这些事件，用差分渲染把消息流、工具调用和状态变化实时画出来，而且不闪烁。

顺带说一句它为什么能这么拆：中枢那套东西（loop、context、session、compaction）不碰终端，所以同一套内核既能驱动这里的 TUI，也能被 RPC 或管道调用——这一点 3.7 讲三种运行模式时还会再碰到。

![图片展示了PI架构全局数据流图，说明一条消息从输入到回复的旅程。用户发出指令，通过单一入口pi命令解析配置，建立session。Agent Loop循环处理，包含Content、Compaction、模型调用、模型决策等步骤。TUI仅在interactive模式下显示回复。图中还标注了Session、Agent Loop、TUI等关键部分，以及与之相关的数据存储、外部LLM等信息，与上下文对PI架构的架构总览解析相呼应。](01_PI-Agent_images/B-开源框架解读：PI-/RraSbpI4kozGf2xVbm1cIxjOnsg.png)

---

##### **5.3.2 Agent Loop**

Agent loop 是 Pi 最核心的部分。每次你向 Pi 发送消息，背后都会跑一轮循环。主干大致是这样：

1. 初始化 context：把系统提示词、AGENTS.md、skills 描述、工具描述、历史消息和当前消息拼成完整上下文。
2. Transform / 压缩：检查上下文是否过长，过长就先做 compaction。
3. 调用大模型：把上下文发给当前选中的 LLM provider。
4. 工具调用循环：如果模型要调工具，就执行工具，把结果回灌给模型。模型可能继续调工具，也可能停止。
5. 回复：模型不再调工具时，输出最终回答，本轮结束。

这个流程看起来简单，但要写稳定并不轻松。实际实现里还要处理流式输出、运行中插话（steering）、收尾追问（follow-up）、工具并行或串行执行，以及中断（abort）。这些逻辑都集中在 `runLoop()` 附近。

这个就是一个非常标准的流程了，ClaudeCode,Hermes都采用了他。这个循环也可以理解成是一个标准的React循环。 面试官也问过原题：工业上一个React是怎么做的？**就是上面的内容，请牢记。**

![这张图展示的是PI-Agent架构中的Agent Loop流程，对应文档中提及的React循环内容。该流程依次包含五个环节：第一步是接收输入，内容为用户Prompt、系统Prompt、工具定义与对话历史；第二步是模型推理，由Claude分析上下文生成回复，回复形式包含文本与工具调用请求，工具调用请求为可选内容；之后会进行是否调用工具的判断，若无需调用工具则进入第五步返回最终结果，若需要调用工具则进入第三步执行工具，由Harness执行工具并收集结果，该步骤仅限检查、执行、返回结果；第四步为结果回注，将工具结果追加到对话历史，随后会跳转回第二步的模型推理环节，形成完整循环。](01_PI-Agent_images/B-开源框架解读：PI-/L4UEb8usGowbxMxuW8GcoEsrnBh.png)

> 源码入口：`packages/agent/src/agent-loop.ts` 的 `runLoop()`、`streamAssistantResponse()`、`executeToolCalls()`。

---

##### **5.3.3 Context 组装**

模型本身没有长期状态。每次调用，都要把它需要知道的内容重新放进 context。Pi 的 context 通常包含这些部分：

- 系统提示词：硬编码的极简模板，大约 20 行。可以追加 `append-system.md`，用 `--system-prompt` 覆盖，也可以用 `system.md` 完全替换。
- AGENTS.md：home 目录和当前工作目录里的项目说明会被追加进来。Pi 也兼容读取 `CLAUDE.md`。
- Skills 描述：所有已加载技能的 name、description、location。
- 工具描述：当前启用工具的说明。
- 历史消息或摘要：本轮之前的对话；如果已经压缩过，就使用摘要。
- 当前消息：用户这次输入的内容。

这里有个很重要的选择：系统提示词刻意保持短。把太多 AGENTS.md、skills 或行为规则塞进去，会撑大上下文，也会稀释模型注意力。

> ❓**思考题：读到这里，想清楚一个问题：Skills 到底是怎么"被调用"的？**
> 
> 简答：Pi 不是把所有 Skill 全文都塞进上下文，也不是把 Skill 做成一个特殊工具。它先把每个 Skill 的 name、description、location 放进系统提示词，并提示模型：如果任务匹配某个 Skill，就用 `read` 工具读取对应文件。也就是说，Skill 的自动使用是"提示词引导 + 模型判断 + read 工具按需加载"。如果用户显式输入 `/skill:name`，Pi 才会直接把这个 Skill 文件展开进用户消息。

> 源码入口：`packages/agent/src/harness/system-prompt.ts`、`packages/coding-agent/src/core/system-prompt.ts`。

---

##### **5.3.4 Tools**

Pi 默认只给模型 4 个工具：

**read**：读文件。

**bash**：执行 shell 命令。

**edit**：编辑文件。

**write**：写文件。

工具很少，但组合起来够用。尤其是 `bash`，它能调用系统已有命令，很多搜索、列目录、检查项目状态的需求都可以通过它完成。

源码里还有 `grep`、`find`、`ls`，但默认不启用。它们主要给**只读模式用**。比如通过 `--tools read,grep,find` 启动时，Agent 可以查文件，但不能直接改文件或执行任意 shell 命令。这样同一套工具实现可以切换出"可写"和"只读"两种工作方式。因为在可写模式下，给到了Agent Bash工具，它本身就可以通过Bash来调用grep查找，不必要再给grep了。但是在只读环境下，不能给Agent bash工具，所以需要给它grep,find,ls.

> 源码入口：`packages/coding-agent/src/core/tools/index.ts`，看 `createCodingTools()` 和 `createReadOnlyTools()`。

---

##### 5.3.5 Sessions

这一小节把Agent系统的存储机制，如何恢复讲得非常清楚。其实也是一个标准的行业做法了，行业里叫会话存储。ClaudeCode和Pi都是用的是JSONL存储。存储方式类似，里面的一些回退细节不一样。不过本质相似，学习了本小节，对于Agent会话存储会有深入的了解。

**怎么存：一个会话 = 一个 JSONL 文件，只追加**

会话文件放在 home 目录下的 `~/.pi/agent/sessions/`，并按工作目录编码成子目录。也就是说，你在 `dashboard` 项目和在 `weather-app` 项目里的对话，会自然分开保存。

一个会话就是一个 `.jsonl` 文件，结构很简单：

- 文件**第一行**是文件头，记录会话 `id`、`cwd`（工作目录），以及可选的 `parentSession`。
- 之后**每一行是一个条目（entry）**，新条目只往文件末尾 `append`，从不回头改写已经写下的行。

这种"只追加、不改写"的写法有两个好处：写入快（不用重写整个文件），历史天然不可变（不会把旧数据写坏）。

**什么时候写？**

 是 agent loop 跑的过程中边跑边写，不是等一轮结束才统一落盘。具体有三种时机：每产生一条消息（你的输入、模型回复、每个工具结果，对应 loop 的 `message_end` 事件）就立即 append 一行；每做一次压缩，也立即 append 一条 compaction 摘要节点；只有换模型、改 thinking、改工具集这类配置变更是例外，会先排进一个队列、推迟到一轮（turn）的边界再统一 flush（这点呼应 5.3 讲的 turn 快照：配置变更收敛到轮的边界生效）。换句话说，对话内容实时落盘以防丢失，配置变更则按轮归并。

条目不只有聊天消息。除了 `message`，还有 `model_change`（换模型）、`compaction`（压缩摘要）、`label`（给某条消息打标签），以及一类专门用来记录"当前位置"的条目。但不管哪种，每个条目都带同样的两个关键字段：

```Plain Text
{ "id": "条目自己的ID", "parentId": "我接在哪个条目后面", "type": "message", ... }
```

**`parentId` 是整棵树的命脉**：它记录"我的父节点是谁"。一个扁平的文件，靠这一个字段就能还原出树形关系。

**分支怎么长出来：正常是链，回头再接才分叉**

新消息的 `parentId` 取自一个表示"当前位置"的指针——也就是"你现在站在树的哪个节点上"。正常聊天时，每发一条，新条目的 `parentId` 就指向上一条，于是连成一根链：

```Plain Text
A ← B ← C ← D     （正常对话，看起来就是直线）
```

分叉发生在你**回到中间某个节点再往后发**的时候。假设你回到 B，然后发了新消息 E，此时 `E.parentId = B`：

```Plain Text
        C ← D      ← 老分支（C 的父节点是 B）
       /
A ← B
       \
        E          ← 新分支（E 的父节点也是 B）
```

B 一下子有了两个孩子 C 和 E——**分叉就这么出现了**。注意：老分支 C、D **一行都没被删**，仍然躺在同一个文件里。所谓"会话树"，就是这样从一个扁平文件里自然浮现出来的。

**回退怎么实现：不删数据，只挪一个指针**

这里是最关键、也最反直觉的一点。Pi 的回退**不删除任何历史**，它做的只是两步：往文件追加一行"我把当前位置挪到 X 了"，然后把内存里的"当前位置"指针指向 X。仅此而已。

那为什么回退后，模型就"忘掉"了被抛弃的那条分支？因为**喂给模型的上下文，从来不是整棵树，而是从当前位置顺着 `parentId` 一路爬到根的那一条链**。源码里就是一个 while 循环：从当前节点出发，不断取 `parentId` 找父节点，直到根，沿途收集到的条目就是这一轮的上下文。

于是：

- 你站在 E 这条分支 → 模型看到 `A → B → E`，**完全看不到 C、D**。
- 你回到 D → 模型看到 `A → B → C → D`，这次轮到 E 不在路径上。

**这就是"回退让上下文变干净"的真相**：不是谁删了数据，而是取上下文时只走当前这一条根路径，被你放弃的分支天然不在路径上。文件里其实什么都没少。

> 一句话记忆：**树是存储形态（文件里所有分支都在），链是喂给模型的形态（只取当前节点到根的一条）。**

![这张图结合文档关于Sessions的内容，以JSONL存储文件和模型所见重构树的对比，直观呈现“回退让上下文变干净”的原理。左侧是由6条数据构成的example.jsonl存储文件，每条数据对应树节点，明确标注了节点的parentid属性；中间通过箭头指示需沿parentid从当前节点追溯至根节点，得到模型使用的链。右侧展示重构树，根节点为A，节点链为A→B→E，其中D节点仍存在于文件中，但因不在当前节点到根的路径上，不被送入模型，以此对应“树是存储形态，链是喂给模型的形态”的内容，清晰体现了只取当前节点到根的一条路径数据作为模型上下文的核心逻辑。](01_PI-Agent_images/B-开源框架解读：PI-/WnBCbPp3Sobf52xeE3PcpxB8nIf.png)

**如果中间发生过压缩：树里会多出一个 compaction 节点**

前面讲了两种"动作"在文件里的样子：正常聊天往链尾接消息节点，回退则追加一行"挪指针"。你迟早会遇到第三种节点——**压缩（compaction）节点**。它的存储套路和前两种一模一样，在这里先把"它长什么样、爬链时怎么被用"讲清楚；到了 3.6，就只剩"什么时候压、压哪一段"这种纯策略问题了。

**压缩节点也只是往链尾又 append 的一行。** Pi 决定压缩时，不删任何旧消息，只是造一个 \`compaction\` 节点追加到文件末尾，\`parentId\` 指向"压缩那一刻的最新消息"。假设压缩前是这样：

```Plain Text
A ← B ← C ← D        （D 是当前 leaf）
```

压缩后，文件只多了一行 K：

```Plain Text
A ← B ← C ← D ← K        （K.type = "compaction"，K.parentId = D，K 成为新 leaf）
```

A、B、C、D **一个字都没改**，K 只是又一行追加。之后你再发消息 E，照常接在 leaf 后：\`…D ← K ← E\`。

**K 节点里装了什么？** 看源码 \`types.ts\` 的 \`CompactionEntry\`，关键就两样：

```Plain Text
{
  "type": "compaction", "id": "K", "parentId": "D",
  "summary": "## Goal … ## Progress …",   // 摘要文本：把更早的历史总结成结构化文字
  "firstKeptEntryId": "C"                  // 保留起点：从 C 起的原文留着，比 C 更早的用摘要顶替
}
```

注意它**不存被压缩消息的副本**，只存一段 \`summary\` 加一个指针 \`firstKeptEntryId\`。这个指针是钥匙：它把链切成两段——\`firstKeptEntryId\`（这里是 C）**之前**的（A、B）将被摘要替换，从 C 起的原文继续保留。

**压缩在哪一步真正生效？还是在"爬链取上下文"那一步。** 回退小节说过，喂给模型的上下文是 \`getPathToRoot\` 从 leaf 爬到根的那条链。现在链上多了个 K，爬出来是完整的 \`A → B → C → D → K → E\`（compaction 节点本身也在链里）。魔法在下一步 \`buildSessionContext\`（session.ts）：它把这条链翻译成"喂给模型的消息"时，遇到 compaction 节点会特殊处理—

1. 先放一条**摘要消息**（K 里的 \`summary\`），代表被压掉的早期历史；

2. 再接 \`firstKeptEntryId\` 到 K 之间的**原文**（C、D）；

3. 最后接 K 之后的**新消息**（E）。

于是模型实际看到的是 `[摘要] → C → D → E`，而不是 `A → B → C → D → E`。A、B 仍原原本本躺在文件里，只是这一次没被翻译进上下文。

**把回退和压缩并在一起看，其实是同一招：**

> 文件永远只追加、从不改写；所有"看起来像删除或改写历史"的效果，**都发生在"取上下文"那一步，而不是动文件**。回退改的是"从哪个节点开始爬"；压缩则是在链里埋一个 compaction 节点，爬到它时把它前面的原文换成一句摘要。两者都没动磁盘上的一个字节。

记成一句话：**回退换起点，压缩换中段——但文件本身，永远只增不改。**

对照上面那张"未压缩"的图，这张图画的就是**发生压缩后**的样子：链尾多出一个 \`compaction\` 节点 K，它带着 \`firstKeptEntryId\` 指针把历史切成两段，于是喂给模型的上下文从"整条原文链"变成了"摘要 + 最近原文"。

![图片展示了PI-Agent架构中Sessions的部分内容。左侧是session.jsonl文件，记录了对话历史。中间是重建的树结构，保留原文，压缩中段，通过compaction节点用指针指向早期历史。右侧是上下文发送给LLM（在buildSessionContext后）的内容，包括Summary、C、D、E。底部强调核心：回退换起点、压缩换中段，但文件永远只增不改，还说明了回退换起点和压缩换中段的实现方式。](01_PI-Agent_images/B-开源框架解读：PI-/WKuobmO4ioJ9tGxakUfcYrQ2nef.png)

**一个重要的边界：回退只回退对话，不回退代码**

上面说的回退，全程只在动会话文件里的指针——**它不会碰你工作区里的代码文件**。也就是说，如果 Agent 在 C、D 两步里改过 \`main.py\`，你回退到 B，对话回到了 B 时的样子，但磁盘上的 \`main.py\` 还是被改过的版本。Pi 的内核里**没有任何"文件快照"机制**。

这是 **Pi 极简内核哲学的一个典型取舍**：它不把"还原代码"塞进内核，而是把这件事留给扩展。官方就给了一个示例扩展，思路很直接——**用 git 来记代码快照**：每一轮 Agent 动手前，先用 \`git stash create\` 给当前代码打一个快照，并和"当前会话节点"建立对应关系（一张"会话节点 → 代码快照"的表）；等你回退到某个节点时，再把那一刻的代码 \`stash apply\` 回来。于是几十行扩展，就把"对话 + 代码一起回退"补齐了。

对比一下 Claude Code 会更清楚两条路线：

\- **存储格式上，两者几乎一样**：都是 JSONL、只追加，每条记录带父指针（Pi 叫 \`parentId\`，CC 叫 \`parentUuid\`），都能还原成一棵会话树，回退都不删历史。

\- **区别在回退要不要还原代码**：Claude Code 的回退**内核自带文件快照**，能把对话和代码文件一起还原；Pi 的内核只回退对话，想连代码一起回退得靠扩展（借助 git）补上。

一句话：**底层存储是同一套思想，差别在于"回退"这个动作覆盖到哪——只回对话，还是连代码一起回。**

> 源码入口：`packages/agent/src/harness/session/jsonl-storage.ts`（`appendEntry` 追加、`setLeafId` 移动指针、`getPathToRoot` 取链）、`session.ts`（`appendCompaction` 追加压缩节点、`buildSessionContext` 把链翻译成上下文并处理 compaction）、`types.ts`（`CompactionEntry` 的 `summary` / `firstKeptEntryId` 字段定义）；代码回退的示例扩展见 `packages/coding-agent/examples/extensions/git-checkpoint.ts`。

---

##### **5.3.6 Compaction**

对话变长以后，Agent 不能无限把完整历史塞进模型。Pi 的做法是 compaction：把较早的一段历史总结成摘要，然后用"摘要 + 最近原文"继续对话。

**压缩节点在 session tree 里长什么样、爬链时怎么用摘要顶替历史，已经在 3.5 讲过**（就是那个 \`compaction\` 节点 + \`firstKeptEntryId\` 指针的机制）。所以这一节不再重复"存储形态"，只回答两个纯策略问题：**什么时候压、压哪一段。** 一句话接住 3.5：压缩不删历史，只是在链尾埋一个摘要节点，下一次爬链取上下文时用它顶替早期原文。

**什么时候压缩？——触发时**

Pi 不会在每个工具调用之间反复算上下文，而是只在**轮次边界**检查，主要是两个点：

1. 一轮 Agent 结束后（模型回复完、工具循环也跑完）。
2. 用户下一次发送 prompt 前，避免新一轮刚开始就把上下文撑爆。

除此之外，也可以手动触发，扩展系统也能在合适时机调用压缩。值得一提的是：**\*\*判断"要不要压"的逻辑不在内核 harness 里，而在应用层（\`coding-agent\`）。\*\*** harness 只提供两样东西——一个纯函数 \`shouldCompact()\` 做判定、一个 \`compact()\` 执行动作；至于"每轮结束后该不该调它"，是 \`coding-agent\` 在每个 assistant 回合结束时决定的。这也呼应了 Pi"极简内核、策略外置"的一贯取舍。

**什么时候压缩？——触发阈**

判定函数 `shouldCompact()` 的条件很直白（`compaction.ts`）：

```Plain Text
contextTokens > contextWindow − reserveTokens
```

也就是"当前上下文 token 数，超过了模型上下文窗口减去预留量"。\`reserveTokens\` 默认 **16384**，这块预留是留给压缩本身的——生成摘要要发一次请求、也要容纳摘要输出，不能等真的撑满了才动手。

`contextTokens` 用什么算？**\*\*优先相信模型返回的真实 \`usage\`\*\***（\`totalTokens\`，或 \`input + output + cacheRead + cacheWrite\` 相加），这是最准的。只有两种情况退回字符数估算（约"字符数 ÷ 4"）：一是请求报错、根本没拿到 usage（比如 529）；二是需要估算"保留最近哪一段"时。还有一种是模型直接报 context overflow 错误，这时不等阈值、立即压缩，并自动重试一次刚才失败的请求。

**压缩哪一段？——保留窗口与切点**

Pi 不是把全部历史都压成摘要，而是**保留最近一段原文、只压更早的部分**。保留多少由 \`keepRecentTokens\` 控制，默认 **20000**。具体做法是从最新消息往回累加 token，攒够 2 万就停，这个点之后保留原文、之前交给摘要（对应 3.5 里那个 \`firstKeptEntryId\` 指针）。

> 这个下面的规则其实就比较细节了，和具体的存储粒度（你是以整个提问-回答为粒度存，还是以每一次小的llm返回为粒度存），以及具体的细节，如何避免切坏语义。通常面试官不会问这么细致，这个也和具体业务场景要求相关。我们理解规则灵活运用。

但切点不能乱下刀，有两条硬规则：

\- **不能切断工具调用对。** assistant 发起 tool call、紧跟着 tool result，这两者语义上是一组。Pi 选切点时只认合法边界（user / assistant 等消息边界），**\*\*明确不把 \`toolResult\` 当切点\*\***，避免只留下半截调用链、把上下文弄坏。

\- **回合被切到一半要补救。** 如果按 token 算出的切点正好落在某一轮任务中间，Pi 会把这一轮的前半段**单独再摘要一次**，让保留下来的后半段原文还能接得上，不至于"开头没了、中间突然冒出来"。

**摘要里写什么？——提示词的核心思想**

Pi 的摘要**不是一句"帮我总结上文"**，而是给压缩模型一份措辞严格的提示词，核心思想就一句话：**别续写对话，只产出一份"交接班用的结构化检查点"，让另一个 LLM 能照着它无缝接手工作。** 系统提示词开宗明义就强调这一点（原文大意）：

> 你是一个上下文摘要助手。读完这段对话后，**只**按指定格式输出结构化摘要。**不要**继续对话，**不要**回答对话里的任何问题。

为什么这么强调"不要续写"？因为压缩复用的是同一个对话补全接口，模型很容易把这段历史当成"该我接话了"而真的去回答问题——那摘要就毁了。所以提示词反复用大写 `Do NOT` 把它摁住。

> 这个模板也可以稍微记一下，如果面试问你是怎么压缩的，要记录哪些东西，就是从这里回答。

真正的摘要提示词要求模型按**固定模板**输出，骨架是这几节（这就是压缩策略的"信息取舍"——它规定了什么必须留下来）：

```Plain Text
## Goal             目标：用户到底想完成什么
## Constraints & Preferences   约束与偏好：用户提过的要求、限制
## Progress         进度：### Done 已完成 / ### In Progress 进行中 / ### Blocked 卡住
## Key Decisions    关键决策：做了什么选择、为什么
## Next Steps        下一步：接下来该干什么（有序列表）
## Critical Context  关键上下文：继续工作必需的数据、引用
```

模板末尾还有一句对 Coding Agent 极其关键的硬要求:**"原样保留精确的文件路径、函数名、错误信息"**——这些细节一旦被模型"复述走样",接手的 Agent 就会找错文件、改错函数,所以提示词专门点名它们不许概括。

一句话抓住提示词策略:**它不是压缩文字长度,而是把一段冗长对话"蒸馏"成一份带固定栏目的工作交接单——目标、进度、决策、下一步、以及不许走样的路径/函数/报错。**

**同步还是异步？**

从 Agent 主流程看，压缩是一个**需要等待**的步骤——摘要本身要再调一次模型生成，没生成完就不能安全进入下一轮。所以一旦决定压缩，会先暂停对话，等摘要生成、写入 compaction 节点、重建上下文，再继续。但它不是每轮都阻塞：只有真到阈值才触发，平时到边界点检查一下、没超标就直接继续。区别在于——上下文已经溢出时，压完会自动重试刚失败的请求；只是预防性接近阈值时，压完让下一轮从新上下文继续即可。

下面这张图把整个压缩策略串成一条流程：从"何时触发"的判定，到"压哪段、留哪段"的切点选择，再到提示词把历史蒸馏成结构化摘要，最后接回 session tree。

![图片是Pi Compaction（压缩）策略全流程图，展示了从何时触发、压哪段/留哪段、怎么压、接回session的完整流程。何时触发包括每轮结束、下次prompt前检查等；压哪段/留哪段涉及从最新回复加token、保留最近原文等；怎么压是压缩LLM，需输入被压缩的较早历史等；接回session则将写入session tree，如compaction节点K等。该图与上下文紧密相关，直观呈现了压缩策略的运作过程。](01_PI-Agent_images/B-开源框架解读：PI-/O01Eb5gPRoMk7jxJFMHcmakunMi.png)

总结：**Pi 的 compaction 是在轮次边界触发、由应用层按 \`contextTokens > contextWindow − reserveTokens\` 判定、会等待模型生成摘要的上下文重写步骤；它保留最近约 \`keepRecentTokens\` 的原文、只压更早的前缀，切点避开工具调用对，并把摘要作为新的会话节点接进 session tree（存储细节见 3.5）。**

> 源码入口：`packages/agent/src/harness/compaction/compaction.ts`（`shouldCompact` 阈值判定、`findCutPoint` 选切点、摘要 prompt 模板与生成）、`packages/coding-agent/src/core/agent-session.ts`（每轮结束的检查与自动压缩流程）、`packages/coding-agent/src/core/session-manager.ts`（保存 compaction 节点）。对应视频文稿见 `PI Architecture explained.txt` 的 Compaction 段。

---

##### **5.3.7 CLI 入口和三种运行模式**

> 在看这个章节前，我想请大家思考一个问题？如果你设计了一个coding Agent。你怎么设计这个架构，让它既可以作为一个独立的Agent产品用，又能够像一个插件一样，方便地给到其他的应用，比如Openclaw用，让其他进程能够快速集成Coding的能力？答案就在本小节，PI的这个设计方法值得我们学习。

输入 `pi` 后，入口主要在两个文件：

- `cli.ts`：接住命令，设置进程标题等，然后调用 `main`。
- `main.ts`：解析参数，解析配置，找到工作目录，加载扩展，创建 agent session，然后按指定模式运行。

Pi 有三种运行模式：

\- **interactive**：默认模式，终端聊天界面。

\- **RPC**：程序化调用，给其他程序当后端。比如说你的**小龙虾**，你想外接一个 coding 的能力，就可以使用 PI 的 RPC 模式。

\- **print-stdio**：\`pi "你的问题"\`，打印答案后退出，接近传统 CLI。

因为内核不绑定 UI，同一套 Agent Core 才能被这三种模式复用。

> 源码入口：`packages/coding-agent/src/cli.ts`、`packages/coding-agent/src/main.ts`。

---

##### **5.3.8 TUI**

> TUI这里是负责前端的内容，我没有特别关注。我自己写的项目，前端的内容，完全没有看代码，面试也没问。如果你也不想学前端，也可以基本浏览一下本章节，大概知道它是用什么技术栈实现的就好。

TUI 可以理解成"跑在终端里的前端"。但它不是我们平时说的 Web 前端，也不是 FastAPI 这种后端框架。FastAPI 是 Python 后端框架，通常负责 HTTP API；Pi 这里没有浏览器、没有 DOM、没有 HTML/CSS，也没有 React/Vue。

Pi 的 TUI 技术栈更准确地说是：

\- **运行时**：Node.js。

\- **语言**：TypeScript。

\- **UI 库**：自研的 \`@earendil-works/pi-tui\`。

\- **渲染目标**：terminal，也就是用户当前的命令行窗口。

\- **渲染方式**：输出 ANSI escape sequences，控制光标、颜色、清屏、局部刷新等终端行为

所以它和 Web 前端的对应关系大概是这样（左边是 Web 前端，右边是 Pi TUI 里的对应物）：

- 浏览器 → 终端。
- DOM 节点 → 文本行和 ANSI 控制序列。
- React/Vue 组件 → `Component` 对象。
- CSS 样式 → ANSI 颜色、粗体、下划线等。
- 鼠标/键盘事件 → stdin 里的按键序列。
- 重新渲染页面 → 重新计算终端文本并差分刷新。

`@earendil-works/pi-tui` 里最核心的抽象是 `Component`。一个组件只需要实现 `render(width)`，返回一组字符串；如果它需要处理输入，就再实现 `handleInput(data)`。输入框、Markdown 消息、选择器、弹窗、底部状态栏，本质上都是这种组件。

Pi 没有用现成的 Ink 这类 React TUI 框架，而是自己实现了渲染器。这样做的好处是能更细地控制终端体验：比如差分渲染，只刷新变化的行；同步输出，减少闪烁；处理 bracketed paste；支持 Kitty / iTerm2 图片协议；处理复杂按键和终端尺寸变化。

在架构上，TUI 不直接负责 Agent 推理。它只是 interactive mode 的界面层：用户在编辑器里输入 prompt，TUI 把输入交给 Agent Session；Agent Session 在运行过程中发出事件，比如消息更新、工具开始、工具结束、压缩完成；TUI 订阅这些事件，把它们渲染成终端里的消息流、工具执行块、底部状态栏和各种弹窗。

一句话：**Pi 的 TUI 是 TypeScript + Node.js 写的终端前端，不是 Web 前端；它用自研组件系统和 ANSI 终端控制序列，把 Agent Core 的事件实时画到命令行里。**

> 源码入口：`pi/packages/tui/src/`（自研 TUI 框架，重点看 `tui.ts`、`terminal.ts`、`components/markdown.ts`）、`pi/packages/coding-agent/src/modes/interactive/interactive-mode.ts`（Pi 具体的交互界面如何组装）。

---

##### **5.3.9 多供应商抽象**

> 这里用的是**策略+工厂模式**，和我们笔记里**RAG项目的思路**是一样的。我们RAG项目使用的是一次输入-输出，也没有ReAct，所以没有处理工具，流式SSE的内容，只用处理HTTP格式。不过思路是一样的。

最底层的 `pi-ai` 把不同 LLM 供应商统一成一套接口。OpenAI、Anthropic、Google、Bedrock、Mistral、Cloudflare 等供应商的 API 都不一样，但 Agent Core 不应该关心这些差异。它只需要调用一个统一入口：

```TypeScript
streamSimple(model, context, options
```

这里的核心思想就是策略模式：同一件事，也就是"调用模型并拿到流式回复"，底下可以有多种实现。Pi 不是用传统的"抽象基类 + 子类继承"来做，而是更 TypeScript 的写法：每个 provider 注册一组函数，比如 `stream` 和 `streamSimple`。运行时 `pi-ai` 根据 `model.api` 找到对应的 provider 函数，然后调用它。

可以把流程理解成：

```Plain Text
Agent Core
  -> 调用 streamSimple(model, context, options)
  -> pi-ai 根据 model.api 找到对应 provider
  -> provider 把 Pi 的统一上下文转成供应商请求
  -> 供应商返回流式结果
  -> provider 再转回 Pi 的统一消息事件
```

这里要注意区分 `provider` 和 `api`。`provider` 是模型来源，比如 OpenAI、Anthropic、OpenRouter、GitHub Copilot；`api` 是调用协议，比如 `openai-completions`、`openai-responses`、`anthropic-messages`、`google-generative-ai`。真正决定走哪套调用策略的是 `model.api`。这也解释了为什么很多不同供应商可以共用 OpenAI-compatible 的实现：它们来源不同，但 API 协议相近

provider 主要做的是"适配"。Pi 内部有统一的 `Context`、`Message`、`Tool`、`AssistantMessageEventStream`，但每家模型 API 的字段结构都不同。provider 要负责几件事：

- 把 Pi 的统一消息格式转成供应商请求格式。
- 把**工具定义**和**工具调用**转成供应商支持的格式。
- 把供应商的 streaming chunk 转成 Pi 统一的文本增量、工具调用增量、结束事件。
- 把 token usage、stop reason、错误信息转成 Pi 内部统一结构。
- 处理每家特有的能力，比如 reasoning/thinking、prompt cache、图片输入、headers、OAuth、baseUrl 等。

所以对 Agent Core 来说，换模型就是换 `model`；对 `pi-ai` 来说，换模型就是根据 `model.api` 换一套 provider 策略。Agent loop 不需要知道底层是哪家模型，也不需要在主流程里写一堆 `if provider === "openai"` 这样的分支

一句话总结：**pi-ai\` 用统一接口包住不同模型 API，provider 负责双向翻译：把 Pi 的统一格式翻译成供应商格式，再把供应商响应翻译回 Pi 的统一格式。**

> 源码入口：`pi/packages/ai/src/stream.ts`（统一入口）、`pi/packages/ai/src/api-registry.ts`（provider 注册表）、`pi/packages/ai/src/providers/`（各供应商适配实现）、`pi/packages/ai/src/models.ts`（模型注册表）。

---

#### **5.4 可扩展性**

第 3 章讲 Pi 由什么组成，这一章讲能力怎么接上去。Pi 和很多"功能默认全带"的 Agent 不同，它把大量能力留给扩展系统。

一句话概括**：agent loop 在运行过程中持续广播事件，扩展通过订阅事件、注册能力和 hooks，在不改内核代码的情况下改变 Pi 的行为。**

![图片展示了Pi-Agent的扩展架构及事件系统。上方为扩展层，分为Tool Extension、Provider Extension、Renderer Extension、UI Control Extension及其他扩展，分别对应能力注入、能力注入、能力注入、UI控制及更多能力注入。下方是Agent Loop流程，包含agent_start等事件，事件通过Event System（事件系统）传递，系统内核负责广播事件，基座hooks可实现能力扩展。此图直观呈现了Pi-Agent扩展机制，与上下文介绍的可扩展性内容相契合。](01_PI-Agent_images/B-开源框架解读：PI-/WIKJb92kko6Q9zxuq4CctIX0nMb.png)

##### **5.4.1 事件系统**

Agent loop 运行时会不断发事件：agent 开始、每一轮开始和结束、消息开始、消息更新、消息结束、工具开始执行、工具执行中、工具执行完、模型切换、用户输入等。一共有 30 多种事件。

底层事件总线在 `event-bus.ts`，实现很朴素。它是在 Node `EventEmitter` 上封了一层 `emit` / `on`，也就是发布订阅模式，再加一点错误隔离。某个订阅者抛错，不会直接拖垮整个 Agent。

这套事件广播让扩展可以在工作流的很多位置插入逻辑。扩展和 hooks 都建立在这个基础上。

> 源码入口：`packages/coding-agent/src/core/event-bus.ts`。事件定义在 `extensions/types.ts` 的 `ExtensionEvent` 联合类型里。

##### **5.4.2 Extensions**

扩展本质上是一个 TypeScript 模块。它拿到 `pi` API 对象后，可以做这些事：

- 注册工具：用 `registerTool` 给模型加新能力，比如 web search。
- 订阅事件：用 `on` 在事件上挂回调。
- 注册斜杠命令、快捷键和 CLI flag：对应 `registerCommand`、`registerShortcut`、`registerFlag`。
- 注册或覆盖模型供应商：用 `registerProvider` 接入自定义代理、企业 SSO 等。
- 注册自定义消息渲染器：用来改变某类消息在 TUI 里的显示方式。
- 操控 UI：弹选择框、确认框、输入框，设置页脚、页眉、状态栏和欢迎语。
- 改系统提示词、发消息、控制会话：比如新建、fork、导航、切换会话。

官方讲解里有两个例子很直观：一个是让 Pi 给自己写开机欢迎语扩展，每次启动显示一句随机 quote；另一个是写权限确认扩展，在执行 `rm -rf` 或 `git push -f` 之前先弹窗确认。类似功能在很多 Agent 里是内置项，在 Pi 里则是几十行 TypeScript 扩展。

> 源码入口：`packages/coding-agent/src/core/extensions/`，重点看 `loader.ts`、`runner.ts`、`types.ts`。API 全貌在 `types.ts` 的 `ExtensionAPI` 接口。

##### **5.4.3 Hooks**

订阅事件更像旁路观察；hooks 则可以拦截和改写数据。几个典型 hook 如下：

\- **tool_call**：工具执行前，可以 \`block\` 阻止执行，也可以改写工具参数。

\- **tool_result**：工具执行后，可以改写返回结果。

\- **context**：调用 LLM 前，可以改写即将发送的消息列表。

\- **before_agent_start**：用户提交后、loop 启动前，可以改写本轮系统提示词或注入消息。

-**before_provider_request**：发请求给供应商前，可以替换 payload。

\- **session_before_compact / session_before_tree**：压缩或导航前，可以取消或自定义处理。

权限确认扩展的实现思路就是挂在 `tool_call` 上：检测到危险 bash 命令就弹确认框，用户拒绝就返回 `block`。多个 hook 挂在同一事件上时，会按顺序链式执行。前一个 hook 的修改，后一个 hook 能看到

> 源码入口：设计文档 `packages/agent/docs/hooks.md`，事件结果类型见 `extensions/types.ts` 里的各类 `*EventResult`。

---

#### **5.5 课后作业**

通过这个小节，我是希望能带大家了解PI Agent的一个大概的思想和架构。如果你是想在这个基础上继续去扩展，深入学习，还是得靠大家。我总结了一些可以去做的扩展任务，包括让AI也总结出来了对应的参考代码和官方示例（可能不准）大家多包涵。

如果想在 Pi 基础上动手，可以按下面几个难度推进。下面每条都尽量附上了官方对应的示例扩展或文档，建议先读官方实现再动手——Pi 自带的示例很全，照着改往往比从零写更快。扩展 API 的全貌见 [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)，所有示例扩展都在 [`examples/extensions/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions) 下。

**入门**

- 加一个 web search 工具：用 `registerTool` 注册一个调用搜索 API 的工具。作者自己也提到过，这是他会装的一个常用扩展。参考最小自定义工具示例 [`examples/extensions/hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)；API 见 `extensions/types.ts` 的 `registerTool` 和 `ToolDefinition`。
- 写一个开机欢迎语扩展：订阅 `session_start`，启动时随机显示一句 quote。参考 [`examples/extensions/custom-header.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-header.ts)（演示 `ctx.ui.setHeader`）和 [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)。

**中级**

- 权限确认弹窗扩展：挂 `tool_call` hook，检测危险 bash 命令，比如 `rm -rf`、`git push -f`，执行前弹窗确认，拒绝就 `block`。官方已有现成示例 [`permission-gate.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/permission-gate.ts)；相关的还有 [`protected-paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/protected-paths.ts)（拦截对 `.env`、`.git/` 等路径的写入）和 [`confirm-destructive.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/confirm-destructive.ts)（清空 / 切换 / fork 等危险会话操作前确认）。
- 用 todo 工具替代内置 todo：Pi 内核没有内置 todo。官方示例 [`todo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts) 演示了一个完整的 todo 工具 + `/todos` 命令，带自定义渲染和状态持久化，可以直接参考。
- 自定义主题 / 状态栏：让 Pi 生成一套终端配色主题。入口 `getAllThemes` / `setTheme`，参考 [`mac-system-theme.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/mac-system-theme.ts)（跟随系统深浅色）、[`status-line.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/status-line.ts)、[`custom-footer.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts)。

**进阶**

- MCP adapter：写扩展，把 MCP server 的工具桥接到 Pi 的工具系统。官方没有直接的 MCP 示例，但可以参考 [`dynamic-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts)（运行时动态注册工具）和 [`ssh.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/ssh.ts)（把工具委派到外部进程）的写法。
- 子代理：注册一个工具，工具内部再启动一个 Agent Core 实例处理子任务。官方有完整示例 [`examples/extensions/subagent/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent)，演示带独立上下文窗口的子代理委派。
- Plan 模式：用扩展实现"先出计划，确认后再执行"的工作流，Pi 默认没有这个模式。官方示例 [`examples/extensions/plan-mode/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/plan-mode) 实现了 Claude Code 风格的 `/plan`（只读探索 + 步骤跟踪）。

\- 节点回退后文件也一起回退：如 1.2 所说，Pi 默认 fork / 回退**只回退对话，不动工作区代码**。这个作业就是把代码也接上：订阅 \`turn_start\` 时用 \`git stash create\` 给当前代码打一个快照并和会话节点关联，在 \`session_before_fork\` 时用 \`git stash apply\` 把代码还原到那个节点。官方有现成示例 \[\`git-checkpoint.ts\`\](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/git-checkpoint.ts)，几乎可以直接用；另见 \[\`auto-commit-on-exit.ts\`\](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/auto-commit-on-exit.ts)。

- 用 RPC 模式接入你自己的 OpenClaw：Pi 的 Agent Core 可以脱离 TUI，被别的程序通过 RPC 当后端驱动（见 3.7 的三种运行模式）。这个作业是把你自己的前端 / 程序 OpenClaw 作为 RPC 客户端接进来，由它发消息、收事件，Pi 只当"无头大脑"。参考 RPC 协议文档 [`docs/rpc.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)，以及扩展侧 UI 示例 [`rpc-demo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/rpc-demo.ts)（搭配 [`examples/rpc-extension-ui.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/rpc-extension-ui.ts) 一起看）。

**挑战**

- 从零仿写一个极简 harness：照着 `agent-loop.ts` 的主干，用任意语言实现一遍 init context -> call LLM -> tool loop -> reply，再加上 JSONL 树状会话。这个练习最能帮助你吃透 Agent 的基本运行方式。

---

#### **5.6 面试问题**

> 题目是我出的，都是根据我的面试复盘经验总结的。（答案是AI写的）下面的题目可以说是考察Agent项目的高频考点，我们在面经部分也根据不同项目总结过很多次了。下面这些问题结合当前项目，也就是假设这个项目是你自己做的，面试官问你项目相关问题，你的参考答案。

下面这些回答按"面试可以直接说"的口吻写，不追求把源码细节全背出来，重点是把设计思路讲清楚。

**Q1：你的 Agent 的记忆功能是如何实现的？长短记忆的组成是什么？**

> 其实长期记忆这里，当前项目只有Agent.md，没有自动维护的长期记忆，也就是这样你的Agent项目不记事，这个其实不好，显得项目不聪明。你可以自己扩展一下，答案还是基于当前项目如实回答。

答：我先说一个前提，模型本身是无状态的，它不记得上一轮说过什么，所以记忆其实是我每一轮调用模型前重新组装上下文喂进去的。我把记忆分成短期和长期两层。

短期记忆就是当前这次会话的内容：用户说过的话、模型的回复、每个工具的执行结果。它们都按"只追加 + 父指针"存在一个 JSONL 会话文件里，构成一棵会话树。每轮调用模型前，我从当前叶子节点沿父指针回溯到根，取出这条路径上的消息，组装成上下文。也就是说模型每轮看到的不是整棵树，而是当前分支这一条线。如果这条线太长，就会先做压缩，把旧消息换成摘要，这也是短期记忆的一部分。

长期记忆是文件型的，跨会话存在。比如项目根目录的 AGENTS.md / CLAUDE.md、用户级的全局规则、还有 skills（技能说明）。这些不靠模型临时回忆，而是在我拼系统提示词的时候加载进去。值得一提的是 skills 是按需加载的：系统提示词里只放每个技能的名字、描述和文件位置，不放全文，模型觉得需要时再用 read 工具去读，这样能省上下文。

一句话总结：短期记忆解决"这次对话进行到哪了"，靠会话树的当前分支；长期记忆解决"这个用户、这个项目长期有哪些规则和偏好"，靠加载文件型上下文。

**Q2：你的 Agent 压缩是如何做的？压缩策略和压缩时机是什么？**

答：压缩解决的是上下文越聊越长、最后超出模型窗口的问题。我的做法是把旧的历史消息交给模型，按一个固定模板总结成一份结构化摘要，然后用这份摘要替换掉那段原文，最近的消息则原样保留。

摘要不是随便总结，而是有固定章节的，比如 Goal（目标）、Constraints（约束）、Progress（已完成/进行中/受阻）、Key Decisions（关键决策）、Next Steps（下一步）、Critical Context（关键上下文），并且要求保留确切的文件路径、函数名、报错信息。这样换一个模型接着干也能续上。如果之前已经压过一次，下次是在旧摘要基础上增量更新，而不是从头再总结。

时机上，判断是用 token 占比：当前上下文 token 超过"模型窗口减去预留量"就触发。token 怎么算很关键——我不是用字符数除以 4 去估，而是优先用模型每次返回的真实 usage（input、output、cache 读写几个字段相加），只有最后那几条还没有 usage 的消息才用字符估算补上，这样最准。

还有一个设计上的细节：判断"要不要压"的逻辑其实不在内核里。内核只提供两个能力——一个纯函数 `shouldCompact()` 做判定、一个 `compact()` 执行压缩；至于每轮结束后到底调不调，是上层应用决定的。压缩产生的摘要本身也作为一个节点追加进会话树，之后取上下文时用它替换被压缩的那段历史。

**Q3：你的 Agent 项目架构是什么？从 TUI 层讲到整体。**

答：整个项目是一个 monorepo，分四个包，依赖是单向的，从上到下。

最上面是 TUI 层，一个自研的终端 UI 组件库，负责画界面。它的特点是差分渲染，每次只重画变化的部分，所以终端不闪烁。但 TUI 不直接调内核，它是通过订阅事件来工作的。

中间是产品本体，也就是面向编码场景的 CLI，用户敲的命令入口就是它。它自己几乎不造轮子，而是把另外几个包装起来用：要画界面用 TUI，要智能用 agent core，要连大模型用最底层的 AI 包。它还负责加载扩展、管理工具、决定运行模式。

再往下是 agent core，整个项目的中枢，里面是 agent loop、上下文组装、会话存储、压缩。关键点是它完全不碰终端——它只跑逻辑、广播事件，谁来渲染它不管。正因为这样，它能脱离 TUI 被复用：除了交互界面，还能用一次性打印模式（打印完就退），或者 RPC 模式给别的程序当后端。

最底层是 AI 包，多供应商 LLM 抽象，把 OpenAI、Anthropic、Google 这些不同的 API 统一成一个接口。

所以从 TUI 往下看，本质是一条"事件驱动 + 单向依赖"的链路：内核在中间跑循环、发事件，UI 在外层订阅事件、画界面，两者解耦，这也是为什么同一套内核能配不同的前端。

**Q4：你的项目的 Agent 架构是什么？ReAct 是如何实现的？**

答：核心就是一个手写的 agent loop，本质是标准的 ReAct 循环：推理（调模型）和行动（调工具）交替进行。

一轮的主干是这样：先组装上下文，检查要不要压缩，然后把上下文发给模型；模型流式返回后，我看它这次有没有发起工具调用。如果有，就执行这些工具，把结果作为新消息追加回上下文，再进入下一轮让模型接着看结果；如果没有工具调用，说明它要收尾了，就输出最终回复，循环结束。读写代码、跑命令这些真正的"行动"，都发生在工具这一步。

实际实现里比这几句话要多考虑几件事，这也是我没直接用现成 SDK、而选择手写的原因——为了完全掌控这些细节：一是工具可以并行或串行执行，有些必须串行的工具会触发串行模式，避免抢同一份状态；二是支持运行中插话（steering），用户在模型干活时打字，我会在下一次模型响应前把这条消息插进去；三是支持收尾追问（follow-up），模型本来要停了，如果有排队的新消息会继续接着跑；四是随时能中断（abort）。这些逻辑集中在一个主循环函数里。

简单说，ReAct 在我这里不是一个框架帮我做的黑盒，而是一个我能看到每一步的 while 循环：模型想 → 调工具做 → 把结果还给模型 → 再想，直到它不再需要工具。

**Q5：你的项目如何实现节点回退和会话恢复？存了什么，又如何恢复？**

答：这两个其实是同一套存储机制带出来的，关键在于会话不是存成一个线性列表，而是存成一棵树。

先说存什么。每次产生一条东西——用户输入、模型回复、工具结果、压缩摘要——我都立刻往一个 JSONL 文件追加一行，只追加、不修改、不删除。每条记录都带自己的 id 和一个父指针 parentId，指向它的上一条。靠这个父指针，一个扁平的文件就能还原成一棵树。

会话恢复就是：重新打开时把文件一行行读出来，按 parentId 把树重建出来，然后从当前叶子节点沿父指针一路回溯到根，取出这条路径，就是要喂给模型的上下文。因为是 append-only，历史永远在，恢复不会丢东西。

节点回退靠的是同一棵树。我想退回某个历史节点重新提问，新消息的父指针就指向那个旧节点，于是从那里岔出一条新分支，老分支还原封不动留着。fork、导航、克隆都是基于这种指针关系做的，不需要复制整段历史。

最后补一个我会主动说的点：默认情况下回退只回退对话，不会动工作区里的代码文件——因为内核只管会话树，不管文件快照。如果想让回退连代码也一起还原，需要用扩展接 git 来补，比如每轮用 git stash 打个快照、回退时再恢复。这是我刻意保留给扩展的，内核保持精简。

**Q6：你设计这个项目的整体思路是什么？**

答：一句话概括，我的设计理念是"极简内核 + 一切皆可扩展"。我不去猜用户需要什么，也不把功能一股脑塞进内核，而是先把内核做到最小，剩下的能力都通过扩展机制从外面接上。

先说内核里留了什么。我只保留一个 Agent 跑起来必须有的东西：agent loop（ReAct 主循环）、上下文组装、会话存储、压缩、多供应商的模型抽象，以及最基本的几个工具——读、写、改、执行命令。除此之外，像权限弹窗、MCP、plan 模式、子代理、联网搜索这些，内核里一概没有。好处是内核小、容易读、容易测，攻击面也小；代价是开箱体验会显得空，但这是我故意的取舍。

再说可扩展怎么做，这是关键。我让 agent loop 在运行的每个阶段都广播事件——agent 开始、每轮开始结束、消息流、工具开始执行和执行完等等，一共三十多种。扩展就建立在这套事件广播之上，具体有两个层次。

一个是扩展（extension），本质就是一个 TypeScript 模块，拿到我的 API 对象后可以往里加东西：用 registerTool 加工具、registerCommand 加命令、registerProvider 接自定义模型供应商、注册自定义渲染器改界面，或者订阅事件做联动。另一个是 hooks，它比订阅事件更强，能拦截并改写数据：比如在工具执行前用 tool_call 拦下来做权限确认、在调模型前用 context 改写要发送的消息、在发请求给供应商前替换 payload。

把这两套机制摊开看，内核的每一个部分其实都开了扩展口子：要加能力就注册工具，要换模型就注册供应商，要改提示词就挂 context 或系统提示的 hook，要改压缩就自定义 compaction，要改界面就注册渲染器和页脚页眉，要管权限就挂 tool_call。所以那些"内核没有"的功能——权限、plan、MCP——都能用几十行扩展补回来，而且扩展本身也可以让 Agent 自己写。

总结一下：主线是把内核做小、只做必要的事；可扩展则是靠"事件广播 + 扩展注册 + hooks 拦截"这三件套，让模型调用、工具、上下文、压缩、界面、会话每一个环节都能在不改内核代码的前提下被替换或增强。

#### **5.7 参考资料&源代码**

主要参考了两个Youtube视频和源代码。参考视频不是说大家必须看，只是列出具体来源。

PS: YT视频需要科学上网。英文不怕，下方可以翻译成中文，现在在线翻译的还是比较准的

- [PI Agent Crash Course](https://www.youtube.com/watch?v=N30XGyPrr6I&t=74s)
- [PI Archectrue explained](https://www.youtube.com/watch?v=gTeujlv8qK0&t=1672s)
- 官网与文档：[pi.dev](https://pi.dev) 及其[源代码](https://github.com/earendil-works/pi/tree/main/scripts)。

#### **5.8 讲解视频**

https://www.bilibili.com/video/BV1Bijf66Efs/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

---

## 2. Hermes

### 7.1 Hermes Agent是什么

Hermes Agent 是 **Nous Research** 推出的开源、可自托管的自主 AI Agent 平台，核心卖点是**自我进化**（self-improving）：同一个模型，用得越多，它越懂你。

- 核心用 **Python** 编写（入口脚本 `hermes-agent/hermes`、`cli.py`），通过 `pip install hermes-agent` 或官方一行安装脚本部署
- 支持 Linux / macOS / WSL2 / Termux（**Windows 原生不支持，需要 WSL2**）
- 所有数据都存在本地（`~/.hermes/`），和 OpenClaw 一样不经过云中转
- MIT 协议开源，与 OpenClaw 可通过 **ACP 协议**互相调度

**Hermes 是一个带"自进化闭环"的事件驱动 Agent 执行引擎**——OpenClaw 做的它都做（多渠道网关、cron、子 Agent），但它额外把"经验沉淀成可复用 skill"和"持续学习用户画像"做成了一等公民。

### 7.2 Hermes 总体架构

Hermes 的总体架构是**三层主干 + 一圈闭环**——主干三层是**触发层（Trigger）→ 网关层（Gateway）→ Agent 层（Agent Loop）**，和 OpenClaw 完全同构；闭环是 Agent 层额外挂的**自进化回路（Reflect → 记忆/Skill 沉淀 → 反哺下一次触发）**，这是 Hermes 区别于 OpenClaw 的核心。

所以当面试官问"Hermes 架构是几层"时，标准答法是：**"主干 3 层 + 1 个自进化闭环"**，然后按下面的图展开。

看完第 10 章 OpenClaw 架构这部分可以秒懂，差异集中在 Agent 层额外多了一圈**自进化闭环**：

```Plain Text
触发层  →  网关层  →  Agent 层  →  记忆/Skill 沉淀  →  反哺下一次触发
                              └── 每 ~15 次 tool call 触发自进化反思
```

#### 7.2.1 触发层

Hermes 的触发维度和 OpenClaw 一一对应，同样是 **5 种信号源**，没有新东西。这部分和 OpenClaw 笔记里的触发层完全一致——从这一点也能看出来 Hermes 作者应该是在 OpenClaw 基础上进行改进的，这也是为什么面试官喜欢把两者放在一起对比：

- **Message（消息）** — CLI、Telegram、Discord、Slack、WhatsApp、Signal、Email（比 OpenClaw 多一个 Email）
- **Heartbeat（心跳）** — 周期性唤醒 Agent 进行自检 / 续跑
- **Cron（定时任务）** — 内置 cron 调度器（源码 `hermes-agent/cron/scheduler.py`、`cron/jobs.py`），支持每日/每周自动任务并推送到任意平台
- **Webhook（外部推入）** — 同样支持外部系统 HTTP 推入
- **Hooks（生命周期钩子）** — 会话开始/结束、工具调用前后等事件挂钩，可触发自定义逻辑

#### 7.2.2 网关层 - 一进程多渠道

**Gateway 是什么**：本地长驻的一个进程，是触发层和 Agent 层之间的中间件——所有外部事件（消息、webhook、cron 触发）都先进 Gateway，由它统一接入、认证、再分发给对应的 Agent session。

**核心职责（4 件事，别跑偏）**：

1. **连接管理**：同时维持多个渠道的长连接（CLI、Telegram、Discord、Slack、WhatsApp、Email……一进程多渠道）
2. **协议转换**：把 Telegram 的 JSON、Discord 的 WebSocket 帧、Email 的 MIME、Webhook 的 HTTP POST 等不同协议，统一转换成内部标准事件格式
3. **路由分发**：根据事件里的 agentId / sessionId，把事件投递给正确的 Agent 会话；回复也按原路送回对应渠道
4. **安全控制**：入口处做认证（token / 签名校验）、限流、沙箱隔离

**关键边界（面试必答）**：Gateway **只做路由，不调 LLM，不执行工具**。它只回答两个问题——"这条消息该给哪个 Agent？"、"Agent 的回复该送回哪个渠道？"。这个边界让 Gateway 保持轻量，可以横向扩展，Agent 换掉也不影响接入层。

一句话总结：**Gateway = 多渠道适配器 + 路由器 + 安全网关**，是"一个 Agent 能同时出现在 Telegram、Discord、CLI 里"的技术基础。

#### 7.2.3 Agent 层

Agent 层是整个 Hermes 的"大脑"，Gateway 把事件路由过来之后，真正的推理、工具调用、记忆读写全在这里完成。

**Agent 循环的 4 步**：**Think（推理）→ Act（工具执行）→ Remember（记忆读写）→ Reflect（周期性反思）**。前三步是所有 Agent 都有的标准循环，第 4 步 Reflect 是 Hermes 的独有创新（即**自进化闭环**），在 11.3 节详细展开。

> **自进化循环是什么？** 一句话先打个底：这是 Hermes 的"自我反思 + 经验沉淀"模块。用一句话概括就是 "*like back propagation but for prompts instead of model weights*"——**像反向传播，但更新的不是模型权重，而是 prompt / 记忆 / skill**。周期性触发，让 Agent 回看自己刚才做了什么，把有价值的事实写进 `memory/` md 文件、把成功流程抽象成 Skill、把用户偏好更新到 **Honcho**（一个独立的第三方开源用户建模服务，`honcho.dev`，专门给 Agent 存"这个用户是谁"——偏好、沟通风格、目标；Hermes 作为可选依赖集成它）。完整机制在 11.4.4 讲。后面章节会反复提到"自进化循环"，看到它就想"这是 Hermes 的周期性反思和写记忆的机制"即可。

**什么叫"循环"——ReAct 范式**：

Agent 不是"想一次就直接输出答案"的单次推理，而是\*\*"思考 → 行动 → 观察结果 → 再思考"的多轮迭代\*\*，这就是业界最经典的 **ReAct 范式**（Reasoning + Acting）。一次典型的循环长这样：

```Plain Text
收到用户消息
    ↓
┌──────────────────────────────────────────────┐
│  Think  （调 LLM，自己做决策）                 │
│  LLM 根据当前上下文，输出以下三选一：           │
│   A. 信息不够 → 需要调工具 X，参数 Y          │
│   B. 需要回忆旧信息 → 调 memory_search        │
│   C. 信息够了 → 生成最终回复，结束循环         │
└────────────────┬─────────────────────────────┘
                 │
       ┌─────────┴──────────┐
       │                    │
   A/B:调工具            C:直接回复
       │                    │
       ▼                    ▼
┌──────────────────┐   输出最终回复给用户
│  Act  （执行工具） │   （循环结束）
│  → browser / exec │
│  → 拿到结果       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Remember        │
│  （读写记忆，可选）│
└────────┬─────────┘
         │
         ▼
   工具结果回灌上下文
         │
         └──→ 回到 Think（LLM 再次决策 A/B/C）
```

**关键性质**：

- **"任务完不完，由 LLM 自己判断"**：没有外部调度器在循环外面数圈，而是每一轮 Think 里 LLM 根据当前上下文自主决定"继续调工具"还是"输出回复、结束"。这就是 ReAct 的精髓——**决策权在 LLM 手里**。
- **Think 和 Act 是交替的，不是一次性的**。同一个任务可能循环 3 次、10 次甚至几十次 tool call 才结束。
- **每一轮的工具结果都会回灌到下一轮 Think 的上下文里**，让 LLM 基于新信息继续推理——这就是"推理 + 行动"比"纯推理"强的原因。

> 下面三个小节（11.2.3.1 / 11.2.3.2 / 11.2.3.3）分别讲这个循环里每一步的**具体实现**——Think 层如何调 LLM、Act 层有哪些工具、Remember 层的记忆怎么组织。

##### 7.2.3.1 推理 (Think)

Think 层的职责很聚焦：**把当前上下文（系统提示 + Bootstrap Files + 对话历史 + 上一轮工具结果）送给 LLM，拿到 LLM 的下一步决策**（直接回复 / 调用某个工具 / 调用子 Agent）。

Hermes 在 Think 层的核心要点是**主模型 + 辅助模型分工（Auxiliary Client）**。

Hermes 允许同时配置两个模型，让不同能力的模型干不同的活：

- **主模型**：做长链推理、规划、复杂任务——用强模型（如 Claude Opus、GPT-5）
- **辅助模型**：做压缩、摘要、分类、错误归类等轻量任务——用便宜/本地的弱模型（如 Qwen、Gemma）

这样做的价值是**在成本、速度、质量之间取得平衡**——长链推理用贵的，但压缩一段对话历史这种活没必要也让 Opus 来干。这也是 harness engineering 的典型思路：**不是用一个模型解决所有问题，而是把任务按难度分层、匹配合适的模型**。

##### 7.2.3.2 工具执行 (Act)

Agent 推理过程中可以自主决定调用工具。Hermes 的内置工具覆盖了 Agent 干活的几乎所有场景：

- **终端/exec** — 执行 Shell 命令（带 allowlist 安全策略）
- **浏览器** — 通过 CDP 控制 Chromium，浏览网页、截图、操作页面
- **文件操作** — 读写本地文件、应用 patch
- **消息发送** — 向任意渠道（Telegram / Discord / Email …）发送消息
- **Subagent Spawn** — 启动子 Agent 处理复杂/并行任务
- **MCP 集成** — 通过 Model Context Protocol 接入任意外部工具生态

Hermes 的一个特色是 **6 种终端后端**：`local` / `Docker` / `SSH` / `Daytona` / `Singularity` / **`Modal`**（serverless 持久化，闲时近乎零成本）——这给 Agent 提供了从本地开发到云端大规模执行的全套部署选项。

Hermes 独有的一个小设计：**Error Classifier**（`agent/error_classifier.py`）——把常见失败模式（网络错误、权限错误、文件不存在、rate limit 等）预编码成分类器。这样当工具调用失败时，弱模型不需要从错误消息里自己推理"这是什么错、该怎么恢复"，而是由 Error Classifier 直接把错误归类成已知类别，走预设恢复路径。这就是 harness engineering 的典型落地——**用系统层面的预处理，降低对模型推理能力的依赖**。

##### 7.2.3.3 记忆 (Memory) & Skills

记忆是 Agent 层的第三个核心组件，但不是每次对话都自动塞入上下文（那样太浪费 token），而是 **Agent 主动按需检索**——Agent 自己判断"需不需要回忆过去"，然后调用记忆工具去搜索。

Hermes 的记忆体系分 **5 层 + 1 个用户画像**：

- **Bootstrap Files** — 永久身份与规则（AGENTS.md 等），每次会话开始从磁盘注入
- **Session Transcript** — 完整对话历史存档（JSONL 文件追加写入）
- **Context Window** — 当前推理能看到的内容（满了触发 Compaction）
- **Retrieval Index** — 记忆文件的全文/向量混合检索索引
- **Skill Library** — 程序性记忆，可复用的成功流程（Hermes 独家第 5 层）
- **Honcho User Model** — 独立的用户画像模型，专门存"你是谁"（偏好、沟通风格、目标）

**和 OpenClaw 的对比**：前 4 层（Bootstrap / Transcript / Context / Retrieval）和 OpenClaw 完全一样，Hermes 直接沿用了 OpenClaw 的设计思路；**Skill Library 和 Honcho User Model 是 Hermes 新加的两块**，这是两者记忆体系的核心差异。

> 💡 举个例子，系统中前 4 层属于**陈述性记忆**（"我记得什么事实"），Skill Library 属于**程序性记忆**（"我会做什么流程"），Honcho 是独立的**用户建模**（我是谁）。相比Openclaw,"OpenClaw 只有陈述性记忆，Hermes 把程序性记忆和用户建模也补齐了，这是它'越用越懂你'的理论基础。"

这 6 块是 Hermes "越用越懂你" 的数据底座。具体每一层的存储结构、写入/读取时机、压缩策略、如何协同工作，在 **11.4 节 Hermes 记忆功能详解** 里展开。

#### 7.2.4 架构总览图

到这里我们已经把 Hermes 三层主干（触发层 / 网关层 / Agent 层）都讲完了。下面用一张图把各模块的位置关系串起来，让大家对"一个事件从进来到处理完的完整路径"有个整体印象：

```Plain Text
              ┌──────────────────────────────────────────┐
              │                  触发层                   │
              │  Message · Heartbeat · Cron ·            │
              │  Webhook · Hooks                          │
              └────────────────────┬──────────────────────┘
                                   │ 事件
                                   ▼
              ┌──────────────────────────────────────────┐
              │                 网关层 Gateway            │
              │  连接管理 · 协议转换 · 路由分发 · 安全控制 │
              │         (不调 LLM、不执行工具)           │
              └────────────────────┬──────────────────────┘
                                   │ 统一事件 → session
                                   ▼
              ┌──────────────────────────────────────────┐
              │                  Agent 层                 │
              │                                          │
              │    ┌─────────────────────────────┐       │
              │    │   Think  → Act  → Remember  │ ◄──┐  │
              │    │   (循环，由 LLM 自主决定     │    │  │
              │    │    是否继续 / 结束)          │    │  │
              │    └──────────────┬──────────────┘    │  │
              │                   │                   │  │
              │            工具结果回灌上下文 ────────┘  │
              │                                          │
              │    可用模型：Claude / GPT / Gemini /     │
              │              Qwen / Ollama / …（任选）   │
              │                                          │
              │    记忆体系：Bootstrap · Transcript ·    │
              │              Context · Retrieval Index  │
              │            + Skill Library (独有)        │
              │            + Honcho 用户画像 (独有)      │
              └────────────────────┬──────────────────────┘
                                   │ 最终回复
                                   ▼
                             原渠道送回用户
```

**三点提醒**：

1. 上图是 Hermes 的**静态结构**，还没有画出 Hermes 真正的创新——**自进化循环**。自进化循环本质是作用于记忆层之上的动态更新策略，会在 **11.4 节 · 动态更新策略** 里讲。
2. Agent 层的 Think/Act 循环由 LLM 自主驱动，Gateway **不参与推理决策**——这是职责边界。
3. 记忆体系的前 4 层和 OpenClaw 相同，后 2 层是 Hermes 新增；静态结构见 11.3 节，动态更新见 11.4 节。

### 7.3 Hermes 记忆系统 · 静态结构

（**高频考点**：Agent记忆系统是Agent核心。大家看任何Agent的时候，都应该有意识，去了解一下它的记忆功能是如何实现的。其中记忆功能，大家可以思考两点：由哪几部分组成（静态），如何更新，压缩（动态），笔记的ClaudeCode架构也是这么组织的。想清楚这两点，就想清楚了一个Agent的记忆模块最核心的东西。）

#### 7.3.1 总览：一个上下文窗口 + 三类数据源（+ 一个索引）

先给大家一个整体骨架：Hermes 的记忆系统由一个**上下文窗口**（Context Window）+ **三类数据源** + **一个索引**组成。每轮推理，系统把三类数据源的内容拼进工作集、送给模型；索引只在数据源 1 里按需搜片段，不直接进工作集。下面先看这五个角色分别是什么。

**三类数据源**（真正进 Context 的内容都出自这三类）：

1. **工作空间 md 文件**——人写的（或自进化循环写的）配置和知识文件，包含 Bootstrap Files、`memory/` 笔记、Skill Library
2. **Session Transcript**——系统自动追加的完整对话日志 `.jsonl`
3. **Honcho User Model**——外部独立服务，存用户画像

**一个索引**：

- **Retrieval Index**——为 `memory/` 下的 md 文件建的向量+全文索引。**它自己不进 Context**——它的作用是让 `memory_search` 能快速从 md 文件里找到相关片段，**真正进 Context 的是搜到的那段 md 原文**。

```Plain Text
┌────────────────────────────────────────────────────────────────┐
│  上下文窗口 · Context Window（每轮重新拼装）                 │
│                                                                │
│    = System Prompt（Bootstrap 文件拼出来的）                   │
│    + 近期对话切片（从 .jsonl 尾部加载）                        │
│    + 检索到的 md 片段（memory_search / memory_get 返回的原文） │
│    + Skill 内容（命中时加载 SKILL.md）                         │
│    + Honcho 用户画像摘要                                       │
│    + 当前用户消息 + 工具结果                                   │
└────────────────────────────────────────────────────────────────┘
         ▲                     ▲                     ▲
         │  md 原文            │  对话切片           │  画像摘要
         │                     │                     │
┌────────┴─────────┐  ┌────────┴────────┐  ┌─────────┴────────┐
│ 数据源 1         │  │ 数据源 2        │  │ 数据源 3         │
│ 工作空间 md 文件 │  │ Session         │  │ Honcho           │
│                  │  │ Transcript      │  │ User Model       │
│ Bootstrap Files  │  │ .jsonl 对话日志 │  │ 外部用户画像服务 │
│ + memory/ 笔记   │  │ 系统追加写入    │  │ 自进化循环持续更新│
│ + Skill Library  │  │                 │  │                  │
└────────┬─────────┘  └─────────────────┘  └──────────────────┘
         │ 被索引 ↑
         ▼        │ 搜索请求
   ┌──────────────┴───────┐
   │ 索引           │
   │ Retrieval Index      │
   │ （memory/ 的向量+    │
   │  全文索引，sqlite）  │
   │ 本身不进 Context     │
   └──────────────────────┘
```

**全景一张表**：

![图片是一张表格，对比了Context Window、Bootstrap Files、memory/笔记、Skill Library、Session Transcript、Honcho User Model、Retrieval Index等数据源的存储位置、谁来写及怎么进Context等信息。如Context Window存储在模型RAM，系统每轮拼装；Bootstrap Files存储在~/.hermes/workspace/*.md，用户/自进化循环写入；memory/笔记存储在~/.hermes/memory/*.md，用户/Agent归档/自进化循环写入等。该表与上下文介绍Hermes记忆系统中三类数据源的内容相关，直观呈现了各数据源的特性。](02_Hermes_images/B-开源框架解读：Her/Lox2bW8O2o7o2pxx379cWE1GnEh.png)

**和 OpenClaw 的对比**（直接落到三类数据源上）：

- 工作空间 md 文件 / Session Transcript / Retrieval Index：和 OpenClaw 同构
- Skill Library（工作空间 md 文件里的一类）：Hermes 独有
- Honcho User Model：Hermes 独有

其实不论 ClaudeCode / OpenClaw / Hermes，记忆模块的底层都是"几份磁盘文件 + 一个派生索引 + 一个工作集"这个老套路，差异只在于"多沉淀了什么"。看透这一层，新产品再出也不慌——新东西无非是在这张图上加一个源或改一条注入路径。

#### 7.3.2 Context Window · 上下文窗口

**定位**：固定大小的 token 容器（模型决定：Claude 200K、GPT-4 128K、Gemini 1M），**不是一层记忆，是记忆的消费端**。每轮推理前系统从四类数据源拼装内容填进来。

**每轮被拼进来的内容**（按源码 `prompt_builder.py` + `context_engine.py` 的顺序）：

1. **System Prompt**（来自工作空间 md 文件）：SOUL.md + AGENTS.md + MEMORY.md + TOOLS.md + …
2. **Skill 系统提示**（来自 Skill Library）：精简 skill 描述列表
3. **Honcho 摘要**（来自 Honcho User Model）：用户画像的一段文字摘要
4. **对话历史切片**（来自 Session Transcript）：从 `.jsonl` 尾部加载的最近消息 + 已有压缩摘要
5. **预检索片段**（来自 `memory/` 下的 md 文件，通过 Retrieval Index 搜到，Hermes 特色）：Context Engine 根据当前消息主动做一次 `memory_search`，把命中的 md 原文片段塞进来
6. **当前用户消息 + 工具结果**

**关键性质**：

- 最大 token 消耗者通常是**工具结果**（文件读取、网页快照、API 响应）
- Bootstrap Files 每轮都占空间，所以要尽量精简（SOUL.md 最容易写太长）
- 满了就触发 **Compaction**（见 11.4.3）——压缩的是"当前上下文里的旧消息"，不是整个 `.jsonl`
- 用 `/status` 监控使用量，建议 75–80% 时手动 `/compress`

#### 7.3.3 工作空间 md 文件

这一类是**磁盘上的 Markdown 文件**，用户可以直接编辑，也会被 Agent / 自进化循环写入。虽然都叫"md 文件"，但按用途分成三块。

##### 7.3.3.1 Bootstrap Files

**定位**：会话每次开始都从磁盘读、注入 system prompt 的"身份文件"。

文件清单（位置：`~/.hermes/workspace/`，仓库根目录也有一份）：

- **AGENTS.md** — 操作指令、行为规则（Hermes 主入口文件）
- **SOUL.md** — 人格、语气、边界
- **USER.md** — 用户身份信息（静态版，和 Honcho 互补）
- **TOOLS.md** — 工具使用说明
- **IDENTITY.md** — Agent 名称与风格
- **MEMORY.md** — 策展的长期记忆（仅主会话加载）
- **HEARTBEAT.md** — 心跳任务清单（可选）
- **BOOTSTRAP.md** — 首次运行仪式（一次性）

**关键要点**：

- 每次会话**重新从磁盘读**，不进 `.jsonl` → **免疫 Compaction**
- 字符限制：单文件 20,000 字符，总计 150,000 字符，超出截断
- 子 Agent 只收到 AGENTS.md / SOUL.md / TOOLS.md / IDENTITY.md / USER.md，拿不到 MEMORY.md / HEARTBEAT.md
- 用 `/context list` 查看注入状态
- 尽量精简——每轮都占空间

##### 7.3.3.2 memory/ 笔记

**定位**：Agent 的"事实性知识库"，不自动注入，靠工具按需检索。

位置：`~/.hermes/memory/*.md`、`~/.hermes/memory/**/*.md`。

- 文件命名一般是 `YYYY-MM-DD-slug.md`（归档） 或 `topic.md`（常青）
- 写入来源：用户手写 / 会话结束时自动归档 / 自进化反思产出
- 这些文件被 Retrieval Index 建索引，通过 `memory_search` + `memory_get` 被检索到

与 Bootstrap 的区别：Bootstrap 是"每轮都读"，memory/ 是"需要时才读"。

##### 7.3.3.3 Skill Library

**定位**：把"成功完成过的流程"固化成可执行 skill，下次遇到类似任务直接调用，不用从零推理。

**Skill 文件结构**：

```Plain Text
skills/<category>/<skill_name>/
├── SKILL.md          # skill 描述 + 触发条件 + 步骤说明
├── scripts/          # 可执行脚本（可选）
└── templates/        # 模板文件（可选）
```

**目录分类**（仓库 `hermes-agent/skills/` 自带几百个预置 skill）：

```Plain Text
skills/
├── software-development/   # 代码评审、重构、测试
├── research/               # 论文检索、总结
├── creative/               # ASCII art、Excalidraw
├── productivity/           # PowerPoint、邮件
├── devops/                 # CI/CD、Docker
├── mcp/                    # MCP 集成
└── social-media/
```

**Skill 的三种生成路径**（写入时机见 11.4.1）：

1. **系统预置**：仓库自带几百个 skill，随 Hermes 一起分发
2. **用户安装**：`/skills` 命令或从 agentskills.io 开放标准安装
3. **Agent 自动生成**：自进化闭环触发自动写 `SKILL.md`（如 Hacker News 每日简报的例子）

**两阶段检索**（防上下文膨胀）：先用精简描述粗排命中，再加载对应 `SKILL.md + scripts` 进上下文。

**面试回答模板**：

> "Hermes 在 OpenClaw 的磁盘文件记忆之外加了 Skill Library，本质是程序性记忆。OpenClaw 的 memory 层只能记'事实'，Hermes 的 skill 层能记'怎么做'。这也是为什么 Hermes 号称'越用越懂你'——用户画像（陈述）+ skill（程序）两条线都在进化。"

#### 7.3.4 Session Transcript

**定位**：**一条消息一条消息追加到磁盘**的完整对话归档。只增不改，跨重启持久。

存储路径（注意：不是"一份 session 存两遍"，**两个文件分工不同**）：

```Plain Text
~/.hermes/agents/<agentId>/sessions/
├── sessions.json          # 索引表：所有 session 的元信息（只有一份）
├── <sessionId-1>.jsonl    # 第 1 个 session 的对话正文
├── <sessionId-2>.jsonl    # 第 2 个 session 的对话正文
└── ...                    # 一个 session = 一个 .jsonl
```

- **`sessions.json`（索引表）**：列出所有 session 的元信息——id、标题、创建/更新时间、消息数。类比文件系统的 `ls` 或一本书的"目录页"。
- **`<sessionId>.jsonl`（对话正文）**：存这个 session 的实际内容——每条消息/工具调用/压缩摘要占一行 JSON，按时间顺序 append。

**为什么分开存**：启动时只读轻量的 `sessions.json` 就能列出所有历史会话让你选；选中某个再去读对应 `.jsonl` 重建上下文。

**被"读"的典型场景**（不只是续会话）：

![图片展示了Hermes记忆系统中被“读”的典型场景及对应读取范围。包括续会话从.jsonl尾部加载最近一段进Context，会话结束归档到memory/时扫本次session抽取要点写成md，自进化反思按周期性触发回看最近一段对话判断值不值得沉淀，TUI回滚/分叉按entryId定位某条历史消息，训练数据生成整段导出为trajectory，调试/导出/迁移整段读取。这些场景和读取范围与文档中介绍的Hermes记忆系统相关，是对系统读取行为的总结。](02_Hermes_images/B-开源框架解读：Her/UAPgbcqP3o17EQx870ZcZishnig.png)

**关键要点**：

- Compaction **不读整段 `.jsonl`**——它压缩的是当前 Context 里的旧消息（内存里），只是把结果 append 回 `.jsonl`
- 磁盘上的原始记录始终保留，压缩只改变"下次从哪条之后开始读"（`firstKeptEntryId` 标记）

#### 7.3.5 Retrieval Index

**定位**：为工作空间 `memory/` 下的 md 文件建立的搜索索引。**不是独立存储**——数据完全来自 md 文件，索引只是加速访问的派生物。

**索引范围**：

- `MEMORY.md` + `memory/**/*.md`（默认）
- 可通过 `memorySearch.extraPaths` 加入额外目录（如 Obsidian 笔记库）
- 存储在 `~/.hermes/memory/<agentId>.sqlite`

**检索工具**（两步走）：

- `memory_search` — 语义搜索，返回相关片段（文件路径 + 行号 + 分数）
- `memory_get` — 按路径读取指定记忆文件的完整内容

**混合搜索权重**（和 OpenClaw 一致）：

```Plain Text
finalScore = 0.7 × vectorScore + 0.3 × textScore
```

向量语义匹配（擅长同义词）+ BM25 关键词匹配（擅长精确 ID / 代码符号）加权合并。

**关键要点**：

- 只索引文件——**聊天中说过但没写进文件的内容搜不到**
- 文件变动后自动重新索引（去抖 1.5 秒）
- 支持 MMR 去重 + 时间衰减（默认半衰期 30 天）
- 常青文件（`MEMORY.md`、非日期命名的 `memory/*.md`）不受时间衰减影响

#### 7.3.6 Honcho User Model

**定位**：**独立于对话历史**的动态用户画像，专门存"你是谁"——偏好、沟通风格、目标。不是文件，是一个**外部服务 / 独立模型**。

**和 Bootstrap 里的 USER.md 的区别**：

![这张图片是一张对比表格，用于说明Hermes Agent的Honcho User Model与Bootstrap里的USER.md的区别。表格从三个维度展开对比：存储上，USER.md是磁盘md文件，Honcho是独立服务；更新方式上，USER.md为静态手写、不改动就不会变化，Honcho是动态模型，会在对话后台自动更新；内容来源上，USER.md来自用户自行编写，Honcho则由Hermes或自进化循环从过往对话里推断而来，该对比贴合上下文里关于Hermes记忆系统相关内容的说明。](02_Hermes_images/B-开源框架解读：Her/Atq5bEEt7oBCtSxOPrecVNshnzh.png)

实测对话示例：

```Plain Text
User:  你对我的 user profile 里写了什么？
Hermes: 你正在做基于 Gemma4 + SAM 的视频感知项目……
```

作者没有手写过这些，这是 Hermes 自己从过往对话里学到的——总结成一句话："**RL on user preferences**"。

底层是独立开源项目 `plastic-labs/honcho`，Hermes 原生集成。

#### 7.3.7 小结：从记忆心理学看 Hermes 的升级

前面 6 个小节讲的是"存哪、谁写、怎么进 Context"的**工程视角**。换个**心理学视角**回看，这些源其实对应**人类记忆的三大分类**：

- **陈述性记忆（Declarative Memory）**——"我记得什么事实"

  - 对应：Bootstrap Files + memory/ 笔记 + Session Transcript + Retrieval Index
  - 存的是事实性知识："我喜欢 TypeScript"、"这个项目用 React"、"上周讨论过 X 方案"
- **程序性记忆（Procedural Memory）**——"我会做什么流程"

  - 对应：Skill Library
  - 存的是可执行流程："怎么做代码评审"、"怎么生成每日 AI 简报"
- **用户建模（User Modeling）**——"我是谁"

  - 对应：Honcho User Model
  - 独立于对话历史的动态用户画像

**对比 Hermes 相对 OpenClaw 的升级**：

> OpenClaw 只有陈述性记忆，Hermes 把\*\*程序性记忆（Skill）**和**用户建模（Honcho）\*\*也补齐了——这就是它"越用越懂你"的理论基础，也是面试里最容易讲出深度的切入点。

### 7.4 Hermes 记忆系统 · 动态更新策略

上一节讲完了静态骨架（一个上下文窗口 + 四类数据源），这一节讲**动态血肉**——这些源怎么被**读、写、压缩、反思**。本质上：**写入 / 读取 / 压缩 / 自进化反思都是作用在那些数据源之上的更新策略**。

本节的 4 种策略：

1. **写入策略**（11.4.1）：记忆从哪来？
2. **读取策略**（11.4.2）：记忆怎么被用？
3. **压缩策略**（11.4.3）：上下文满了怎么办？—— Compaction
4. **反思策略**（11.4.4）：Hermes 的核心创新——自进化循环

#### 7.4.1 写入策略：记忆从哪来

对照 11.3 的三类数据源 + 一个索引，每部分的写入来源和时机：

**数据源 1：工作空间 md 文件**

![图片是一张表格，展示了Hermes记忆系统中不同子类的数据写入来源及时机。表格包含子类、写入来源、写入时机三列。Bootstrap Files子类的写入来源为用户手写、从OpenClaw迁移、首次运行生成，时机是一次性/用户编辑时；memory/笔记子类的写入来源为自进化循环自动、会话结束自动归档、用户手写，时机是自进化循环周期性触发；/new /reset时自动保存；Skill Library子类的写入来源为预置、用户、自进化循环自动，时机是任务完成且自进化循环判断“可抽象”。该表与上下文介绍的Hermes记忆系统写入策略相关。](02_Hermes_images/B-开源框架解读：Her/UOlybcH9AoyRnhxwFRvcQQlHnud.png)

**数据源 2 & 3 + 索引**

![图片是一张表格，展示了Hermes记忆系统中三个关键数据源的写入来源及时机。表格包含名称、写入来源、写入时机三列。Session Transcript的写入来源是系统自动，时机为每条消息、每次tool call实时append到JSONL；Honcho User Model的写入来源是自进化循环/对话后台自动，时机为每次对话后持续更新；Retrieval Index（索引）的写入来源是文件监听器自动，时机为memory/等md文件变化后1.5秒内重索引。该表与上下文介绍的Hermes记忆系统写入策略相关，直观呈现了各数据源的写入情况。](02_Hermes_images/B-开源框架解读：Her/MDovbyTg0o3kM8x6kptcnhEfn6b.png)

**两个关键的自动写入点**：

1. **会话结束时的自动归档**：当用户输入 `/new` 或 `/reset`，hook 会自动把最近对话保存为 `memory/YYYY-MM-DD-slug.md` 文件 → 进而被 Retrieval Index 重新索引。
2. **文件监听同步**：用户手动编辑 `MEMORY.md` 或 `memory/` 目录下文件，chokidar 文件监听器检测到变化 → 自动分块、计算 embedding、写入索引库。

**自进化循环驱动的写入**将在 11.4.4 详细展开——这是 Hermes 区别于 OpenClaw 的核心。

#### 7.4.2 读取策略：记忆怎么被用

Hermes 的读取策略分**自动注入**和**按需检索**两大类：

**A. 自动注入（会话开始时无条件注入）**

- **Bootstrap Files**：每次会话开始全量注入 Context Window
- **Session Transcript**：继续会话时从 JSONL 重建上下文到 Context Window
- **Honcho User Model**：会话启动时查询用户画像，摘要后注入系统提示

**B. 按需检索（只有相关时才注入）**

不是所有记忆都无条件塞入上下文（那样浪费 token），有两类内容是按需加载的：

1. **`memory/` 笔记**——有两条检索通道：

   - **系统自动**（Hermes 特色）：Context Engine 每轮推理前根据当前消息自动检索 `memory/`，命中才注入。对弱模型/开源本地模型特别友好，因为它们不一定会主动搜。OpenClaw 没有这一层。
   - **Agent 主动**：LLM 自己判断需要回忆时，调用 `memory_search` → `memory_get` 检索
2. **Skill Library**：先只加载各 skill 的精简描述，匹配当前任务时才加载完整 skill 内容

#### 7.4.3 压缩策略：Compaction

> 我觉得压缩策略可以稍微背一下。因为这些都挺通用的常考的，比如面试官问你上下文满了怎么办，怎么压缩，压缩时候要保留一些什么东西。这些都是很好的经验之谈。

**触发方式**（和 OpenClaw 一致）：

- **自动触发**：上下文使用量达到阈值

  - 溢出恢复：模型返回 context overflow 错误 → 压缩 → 重试
  - 阈值维护：`contextTokens > contextWindow − reserveTokens` 时触发
- **手动触发**：输入 `/compress`，可带自定义指令如 `/compress 重点保留决策和待办事项`

触发公式：上下文窗口 − reserveTokensFloor（默认 20000）− softThreshold（默认 4000）。200K 模型 → 约 176K 时触发。

**压缩过程**：

1. **划分保留区和压缩区**：最近的 \~20,000 tokens 消息进"保留区"，原封不动；之前的旧消息进"压缩区"
2. **分块总结**：压缩区分成若干块，用模型对每块生成摘要
3. **合并摘要**：多个块摘要再合成一个连贯总摘要
4. **写入 Transcript**：JSONL 里写入一条 `compaction` 类型的条目 + `firstKeptEntryId`

压缩后上下文结构：`[压缩摘要] + [保留区原文]`。

**保留策略**（必须保留的内容）：

- 进行中的任务及其状态（进行中 / 阻塞 / 待办）
- 批量操作进度（"17 项中已完成 5 项"）
- 用户最后请求 + 正在做的事
- 已做出的决策及理由
- TODO、开放问题、约束条件
- 承诺的后续行动
- **所有不透明标识符**（UUID、哈希、token、API key、URL、文件名）—— 由 `identifierPolicy: "strict"` 控制

**Pre-Compaction Memory Flush**：

- OpenClaw：压缩前静默运行一轮，提醒 Agent 把重要内容写入 `memory/YYYY-MM-DD.md`，用户不可见（NO_REPLY）
- Hermes：**在此之上多走一步**——不仅 flush 到 memory，还会先调用**自进化反思**，判断"这次有没有新 skill 要沉淀"（见 11.4.4）

Hermes 有自进化循环兜底主动判断关键信息是否保存，但自进化循环不是百分百捕获，**明确告诉 Hermes"记住这件事"仍然是最稳妥的做法**。

#### 7.4.4 反思策略：自进化循环

**这是 Hermes 区别于所有现有 Agent 的标志性特性，面试当作 Hermes 核心卖点必考。** 前面三条（写入、读取、压缩）OpenClaw 大体都有；自进化循环是 Hermes 独创的**第四条更新策略**。

##### 7.4.4.1 自进化循环是什么

核心思想："*like back propagation but for prompts instead of model weights*"——**像反向传播，但更新的不是模型权重，而是 Agent 的记忆、skill 和用户画像**。这里 "prompts" 是泛指所有影响 Agent 行为的非权重部分——对应后面 11.4.4.2 的三路沉淀：memory（事实性知识）、Skill Library（程序性流程）、Honcho（用户偏好）。

核心机制：每隔大约 10 次工具调用，Agent 会主动暂停，回顾刚才发生了什么、哪些步骤失败了，然后更新自身的记忆、skill 和用户画像。

技术实现上：自进化循环在工具调用达到一定次数后周期性触发。不是每次都跑——反思本身也花钱花时间，频繁反思就本末倒置。

##### 7.4.4.2 自进化闭环的完整流程

```Plain Text
1. 用户下达任务（自然语言）
        ↓
2. Agent 执行（Think → Act 循环）
        ↓
3. 每 ~10 次 tool call，Agent 主动暂停（periodic nudge）
        ↓
4. 自问三件事：
   ① 这次学到的东西值不值得保留？
   ② 有没有失败的步骤需要记下来避免？
   ③ 成功的流程能不能抽象成可复用 skill？
        ↓
5. 值得保留 → 分三路沉淀到对应记忆层：
   ├─ 事实性知识 → memory/YYYY-MM-DD.md      （更新 Retrieval Index）
   ├─ 程序性流程 → skills/xxx/SKILL.md        （更新 Skill Library）
   └─ 用户偏好   → Honcho User Model          （更新用户画像）
        ↓
6. 下次遇到类似任务 → 直接命中 skill，跳过重新推理
```

**关键观察**：自进化循环本质上是**跨 3 层记忆的联合更新器**——同时更新 Retrieval Index、Skill Library、Honcho。这就是前面说的"自进化循环是作用在记忆层之上的更新策略"的具体含义。

##### 7.4.4.3 Skill 的自我改进

Skill 不是一次生成就固化了，自进化循环会持续优化。如果 Hermes 再次执行同类任务时发现了更好的做法，会直接更新已有的 skill，而不是新建一个。关键词是 **updating，不是 creating**——只有确实是全新类别才会新建。这是防止 Skill 膨胀的核心机制之一。

##### 7.4.4.4 自进化循环 vs OpenClaw Pre-Compaction Flush

这两个机制容易混，面试可能追问：

![图片是一张表格，对比了OpenClaw Pre - Compaction Flush和Hermes自进化循环的触发时机、模式、更新范围及关注维度。OpenClaw仅在压缩前触发一次，模式为事后归档，更新范围只写memory/ YYYY - MM - DD.md，关注维度是“别让重要信息被压缩丢了”；Hermes每~15次tool call触发，模式为持续反思，更新范围为memory + skill + Honcho三路，关注维度是“值不值留 + 失败要避免 + 流程能抽象”。该表与上下文介绍的两个机制区分内容相关。](02_Hermes_images/B-开源框架解读：Her/QBqGbuSwvognCnxwyW5cOhmVnGf.png)

**一句话区分**：OpenClaw 是**事后归档**，Hermes 是**持续反思**。Hermes 在压缩前也会先跑一次自进化反思，所以可以理解为"自进化循环 ⊇ Pre-Compaction Flush"。

#### 7.4.5 小结：一张动态更新全景图

把四种策略都映射到 6 层静态记忆上，得到一张 Hermes 记忆的完整图景：

![该图是Hermes记忆系统动态更新的全景图，左侧为Memory Layers部分，展示了Bootstrap Files、Session Transcript、Context Window、Retrieval Index、Skill Library、Honcho User Model共6层记忆，每一层标注了对应的写入与读取规则；右侧为Dynamic Strategies部分，标注了对应的六种动态更新策略，不同策略通过带箭头的连线与左侧对应记忆层相连，清晰呈现了四种记忆更新策略与6层静态记忆的映射关系，完整呈现了Hermes记忆系统的完整图景。](02_Hermes_images/B-开源框架解读：Her/SuR7beETRodjGrxjDJzcNBtHnYb.png)

### 7.5 Hermes Agent 架构解析

（对应第 10.4 节 OpenClaw 的 Agent 架构解析，回答"Hermes 的多 Agent 架构是什么"。因为Hermes Agent的架构和Openclaw非常像，虽然Agent架构是很重要的一部分，但这里没有什么新东西，就不赘述了）

#### 7.5.1 概述：同样是递归 Centralized

Hermes 的 Agent 架构和 OpenClaw 一样是**递归 Centralized**：

- Parent Agent（主 Agent）对最终回复负责
- 通过 tool call 的方式 spawn subagent
- Subagent 可以继续 spawn 孙 Agent（默认深度比 OpenClaw 宽）

Hermes 的定位是 "*agent loop first with this learning element*"——loop 结构本身是常规的 Centralized，创新在于"learning element"。

#### 7.5.2 Spawn 机制对比

![图片是一张表格，对比了OpenClaw和Hermes在工具名、Runtime选项、默认深度、子Agent上限、ACP协议等方面的差异。OpenClaw的工具名是sessions_spawn，Runtime选项为subagent / acp，默认深度为maxSpawnDepth=1，子Agent上限为maxChildrenPerAgent=5，ACP协议作为harness调用Codex等。Hermes的工具名是spawn_subagent，Runtime选项为subagent / acp / modal（serverless），默认更宽松，子Agent上限可配置且在批量模式下大得多，ACP协议是原生ACP server，可被OpenClaw调用。该表与上下文介绍Hermes Agent架构中Spawn机制对比的内容相关。](02_Hermes_images/B-开源框架解读：Her/Tla5bO2f7ouGtKxJX01cIcjUnxd.png)

关键差异：Hermes 把 ACP 做成**双向能力**——不仅能调别人，还能被别人调。这让"OpenClaw 作 orchestrator、Hermes 作 worker"的组合变得开箱即用。

#### 7.5.3 Agent 通信机制（和 OpenClaw 一样）

通信模式：**Tool Call**（而非 Handoff）——父 Agent 保留控制权。

消息传递：**仅最终结果**，子 Agent 的 chain-of-thought 留在私有 session 里，父 Agent 只收到蒸馏后的回复。

这和 OpenClaw 第 10.4.3 节的策略完全一致——两者在"多 Agent 通信"这块没有本质差异，都是业界主流做法。

### 7.6 面试问题

吸收了上面的内容，你可以足够应付大部分的 Hermes 面试问题。这一小节快速总结上述知识，给出标准面试参考答案，用这些面试问题检验自己吧\~

**Q1: 你看过 Hermes Agent 源码吗？简单讲讲它的架构和 OpenClaw 的区别。**

看过。Hermes 是 Nous Research 开源的自主 AI Agent 平台，核心用 Python 编写。架构上和 OpenClaw 是同构的三层管道：触发层（Messages / Heartbeats / Crons / Webhooks / Hooks）→ 网关层（多渠道适配 + 路由 + 安全）→ Agent 层（Think → Act → Remember 循环）。这三层和 OpenClaw 几乎 1:1 对应。

核心区别在 Agent 层额外多了一个**自进化闭环**。OpenClaw 是纯执行型——把当下任务做好就结束。Hermes 在执行之外加了周期性反思机制，会把经验沉淀为三样东西：事实性知识写入 memory 文件、成功流程固化为 Skill 文件、用户偏好更新到 Honcho 用户画像。所以 OpenClaw 是执行型 Agent，Hermes 是学习型 Agent。

两者不是替代关系，而是搭档关系——通过 ACP 协议互相调度，OpenClaw 做 orchestrator、Hermes 做 learning worker 是社区共识的最佳实践。

**Q2: Hermes 的架构是几层？每层做什么？**

Hermes 的架构是主干 3 层加 1 个自进化闭环。

第一层是触发层，有 5 种信号源，包括用户消息（CLI、Telegram、Discord、Slack、WhatsApp、Email）、心跳定时唤醒、Cron 定时任务、外部 Webhook 推入，以及生命周期钩子。这一层和 OpenClaw 完全一致。

第二层是网关层，也就是 Gateway。它是一个本地长驻的进程，负责连接管理、协议转换、路由分发和安全控制。一个很重要的边界是，Gateway 不调 LLM、不执行工具，它只负责两件事："这条消息该给哪个 Agent"和"Agent 的回复该送回哪个渠道"。

第三层是 Agent 层，也就是核心推理循环：Think 推理、Act 执行工具、Remember 读写记忆，由 LLM 自主驱动决定是继续调工具还是输出最终回复。Hermes 还支持主模型加辅助模型的分工，强模型做长链推理，弱模型做压缩摘要这种轻量任务。

除了这三层之外，Hermes 还有一个自进化闭环，这是它和 OpenClaw 最核心的区别。Agent 层在工具调用达到一定次数后会周期性触发反思，Agent 会自问三件事：学到的东西值不值得保留、失败的步骤要不要记下来避免、成功的流程能不能抽象成 skill。然后把结果分三路沉淀到 memory 文件、Skill Library 和 Honcho 用户画像，反哺下一次任务执行。

所以整体来看，本质是一个事件驱动的执行管道：事件产生、网关路由、Agent 执行、状态持久化，然后额外多了反思沉淀和反哺下一次执行这两步，最后这两步是 Hermes 独有的。

**Q3: Hermes 的记忆功能是如何实现的？**

Hermes 的记忆系统我会从静态和动态两个角度来讲。

静态上它有 6 层。前 4 层和 OpenClaw 是完全一样的：第一层是 Bootstrap Files，就是 AGENTS.md、SOUL.md、USER.md 这些身份文件，每次会话开始从磁盘读取注入系统提示，不受压缩影响。第二层是 Session Transcript，完整的对话历史持久化到数据库，续会话时从里面重建上下文。第三层是 Context Window，就是模型每轮推理实际看到的 token 容器，满了会触发压缩。第四层是 Retrieval Index，为 memory 文件建的向量加全文混合搜索索引，权重是 7:3，Agent 通过 memory_search 工具按需检索。

后 2 层是 Hermes 独有的。第五层是 Skill Library，这是程序性记忆，把成功完成过的流程固化成 SKILL.md 加可执行脚本，下次遇到类似任务直接调用，不用从零推理。第六层是 Honcho User Model，这是一个独立的用户画像服务，存的是你的偏好、沟通风格、目标，会话启动时查询摘要注入上下文。

前 4 层属于陈述性记忆，就是"我记得什么事实"；Skill Library 属于程序性记忆，就是"我会做什么流程"；Honcho 是用户建模，就是"你是谁"。OpenClaw 只有陈述性记忆，Hermes 把程序性记忆和用户建模也补齐了，这就是它"越用越懂你"的理论基础。

动态上有 4 种策略：写入策略包括手写、会话结束自动归档、自进化循环自动写入；读取策略分自动注入和按需检索；压缩策略就是 Compaction，把旧消息压缩成摘要、保留最近的原文；反思策略就是自进化循环，周期性触发三路沉淀。

**Q4: Hermes 的自我进化功能是什么？怎么实现的？**

Hermes 的自我进化功能叫自进化循环，英文叫 self-improvement loop。它就像神经网络的反向传播一样，但更新的不是模型权重，而是 Agent 的记忆、skill 和用户画像。

具体实现是这样的：Agent 在工具调用达到一定次数后会周期性触发反思，触发之后 Agent 会自问三件事：这次学到的东西值不值得保留？有没有失败的步骤需要记下来避免？成功的流程能不能抽象成可复用的 skill？

如果值得保留，就分三路沉淀：事实性知识写入 memory 文件，更新检索索引；程序性流程写成 SKILL.md，更新 Skill Library；用户偏好更新到 Honcho User Model。而且反思任务是在主回复返回给用户之后在后台执行的，不会阻塞用户交互。

和 OpenClaw 对比的话，OpenClaw 有一个 Pre-Compaction Flush 机制，但那只在压缩前触发一次，属于事后归档，而且只写 memory 文件。Hermes 的自进化循环是持续反思，同时更新 memory、skill、Honcho 三路，而且压缩前也会额外跑一次。所以可以理解为自进化循环包含了 Pre-Compaction Flush。

另外 skill 也不是一次生成就固化了。如果 Hermes 遇到已有类似 skill 且发现更好的做法，会优先更新已有 skill 而不是新建，这也是防止 skill 库膨胀的核心机制之一。

**Q5: 自进化循环会不会导致 Skill 膨胀？怎么治理？**

会的，这是任何持续学习系统都绕不开的问题，学名叫 Memory Bloat。Hermes 做了三层治理。

第一层是准入门槛。自进化循环的三问里第一条就是"值不值得保留"，大多数情况会直接丢弃，不是每次反思都会产出新 skill。

第二层是合并优先。遇到类似任务的时候优先 update 已有 skill，不建新的。关键词是 updating 不是 creating。

第三层是分类组织。skill 按类别分目录，比如 software-development、research、creative、productivity 这些，检索的时候只扫相关子集，不会全量比对。

不过即便有这三层，实际使用中还是需要周期性的人工审查。社区的常见做法是每月跑一次 hermes skills audit，列出低使用频率和重复的 skill，让用户选择清理。我觉得核心思路是：持续学习系统的挑战不是"能不能记住"，而是"怎么有选择地遗忘"。

**Q6: Hermes 和 OpenClaw 你会怎么选？有什么区别？**

两者是同一代 Agent 产品，都是事件驱动 + 多渠道网关 + Agent Loop 的架构，三层管道几乎 1:1 对应。核心差异在设计哲学：**OpenClaw 是执行型 Agent**，强调当下把任务做好；**Hermes 是学习型 Agent**，在 OpenClaw 4 层记忆之外加了 procedural memory（Skill Library）和 Honcho 用户画像，通过自进化循环周期性反思并持久化——所以它越用越懂你。

各自强项也不同。Hermes 的优势在于自进化循环、自动 Skill 沉淀、Honcho 用户建模、模型中立对开源模型友好、同模型下更快。OpenClaw 的优势在于团队更大资源更多、更新频率更高、更稳定、生态更成熟（原生 Cursor / Claude Code 插件）、社区更大文档更全。

从 harness engineering 的角度看，OpenClaw 是最小优雅 harness，Hermes 是激进 harness——把记忆、技能、反思全做成系统能力。这也是 Hermes 在本地开源模型（Qwen、Gemma）上效果更好的原因：弱模型 + 强 harness ≈ 强模型 + 弱 harness。

实际工程里两者**不是替代关系，而是搭档关系**——通过 ACP 协议可以互相调度。推荐用法是 OpenClaw 做 orchestrator 负责接收请求和任务拆分，Hermes 做 learning worker 负责执行细分任务和沉淀 skill，这是社区共识的最佳实践。

**Q7: 自进化循环里的"三件事反思"到底是怎么实现的？**

这个问题可以拆成四层看：

**第一层是代码调度层，决定什么时候触发反思。** `run_agent.py` 里硬编码了两个计数器，`_memory_nudge_interval = 10` 和 `_skill_nudge_interval = 10`，每次 user turn +1、每次工具调用 +1，到阈值就置 flag 然后清零。这是纯 Python 的事件驱动，不是让模型自己判断该不该停下来反思——因为让模型自省"你现在该不该自省了"本身就是不可靠的。

**第二层是后台 agent 层，决定怎么反思。** 触发之后，代码不会打断主对话，而是等主回复给完用户之后，在后台线程里 spawn 一个全新的 AIAgent 实例，模型、工具、对话历史快照都复制过去，只是把反思提示词作为新的 user message 追加。这个细节我觉得很关键——**反思不占主对话的 attention，也不阻塞用户**，用户感知不到，但记忆在后台持续沉淀。

**第三层是提示词层，决定反思什么。** 三个 review 提示词是写死的常量（`_MEMORY_REVIEW_PROMPT` / `_SKILL_REVIEW_PROMPT` / `_COMBINED_REVIEW_PROMPT`）。比如记忆反思的核心就两问："用户是否透露了关于自己的信息？""用户是否表达了对你行为方式的期望？" Skill 反思问："是否用了非平凡的方法？是否经历了试错？" 并且提示词最后都明确要求——**如果不值得存，就直接说 'Nothing to save.' 然后停止**。这个"允许什么都不做"的兜底设计是防止 skill 膨胀的第一道闸。

**第四层是工具持久化层。** 后台 agent 如果决定保存，就调用 `memory` 工具写入 `~/.hermes/memories/MEMORY.md` 和 `USER.md`，或者调用 `skill_manage` 工具在 `~/.hermes/skills/` 下创建 `SKILL.md`。两个工具都带安全扫描防 prompt injection，因为这些内容下一次 session 会被注入系统提示词，不能被污染。下一次启动时 `prompt_builder.py` 读文件注入 context，闭环完成。

**除了定时反思，系统提示词里还有常驻引导**——`MEMORY_GUIDANCE` 和 `SKILLS_GUIDANCE` 两段文字在每次对话时都注入，提醒模型日常就主动保存。所以反思不完全依赖定时兜底，是"日常引导 + 定时强制复盘"双轨。

**我从这个设计里学到最重要的一点是**：这是典型的 harness engineering 分工——**把 LLM 不擅长的事情交给代码，把代码做不了的事情交给 LLM**。"什么时候反思"是调度问题，代码能稳定搞定；"这段对话里有没有值得沉淀的东西"是语义判断，只能交给模型。纯提示词做不到，因为模型不会自己记着"我已经聊了 10 轮了该反思了"；纯代码也做不到，因为代码没法判断一段自然语言对话里哪些是用户偏好哪些是临时需求。把两者边界切得足够清，这个系统才能跑得稳。

### 7.7 Hermes 源代码

https://github.com/nousresearch/hermes-agent

### 7.8 视频讲解

https://www.bilibili.com/video/BV1J9o4BnE2n/?vd_source=144bec9c3f54e465073138bed788be1b

---

## 3. ClaudeCode源码解读

### 8.1 事件概述

> 这节就讲下事件起因，大家看看就好，了解事件的来龙去脉。算是近期（2026年4月）的一个谈资。

#### 8.1.1 怎么泄漏的

2026 年 3 月底，安全研究者 Chowan Chow 发现 Anthropic 发布在 npm 上的 `@anthropic-ai/claude-code@2.1.88` 包中意外包含了一个约 60MB 的 **source map 文件**（`.map`），这个调试文件直接映射回了 Claude Code 的完整未压缩 TypeScript 源码，甚至可以通过 Anthropic 自己的 R2 云存储桶以 zip 包形式直接下载。一共 **1,902 个文件、约 51.2 万行 TypeScript 代码**就此公之于众。

根本原因是一个低级的配置遗漏——开发团队忘记在 `.npmignore` 中添加 `*.map`。Claude Code 的创建者 Boris Cherny 确认这是人为失误，与打包工具 Bun 的 bug 无关。讽刺的是，这已经是**第二次**发生同样的错误。Anthropic 随后迅速发起 DMCA 下架通知，但代码早已被广泛分发和归档，无法收回。需要明确的是，此次泄漏仅涉及产品代码（Agent 框架），不包含任何客户数据、API 密钥或模型权重。

#### 8.1.2 泄漏揭示了什么

泄漏的代码完整揭示了 Claude Code 的内部架构。它本质上是一个用 TypeScript 编写的 **AI Coding Agent**，核心是经典的**查询循环（Query Loop）+ 工具系统**架构，外加多层记忆系统、上下文压缩算法、权限与安全机制等工程组件。本文后续章节将从以下几个维度逐一深入分析：

- **核心架构**：Query Loop、工具系统、System Prompt 分层设计、终端 UI 引擎
- **记忆与上下文**：多层记忆架构、5 级上下文压缩（Compaction）策略
- **安全与权限**：权限模式、YOLO Classifier、Prompt Injection 防御
- **多 Agent 协作**：子代理模型（Fork / Teammate / Work Tree）、Coordinator Mode

此外，代码中包含 **44 个编译时 Feature Flag**，暴露了大量尚未公开的内容：

- **未发布功能**：24/7 自主守护进程 Kairos、记忆整合的 Dream System、30 分钟深度规划 Ultra Plan、反蒸馏防御 Anti-Distillation、卧底模式 Undercover Mode 等
- **未发布模型**：Capybara/Mythos（全新产品线）、Numbat（完全未知）、Opus 4.7 / 4.8 等下一代模型代号

#### 8.1.3 社区反应

> 这里我们在笔记的 Harness Engineering工程中，来讲解这个Claw Code开源项目。学习这个项目，可以进一步帮我理解Harness工程（无疑这个也是26年的高频考点）。你自己其实也可以更深入学习这个项目，自己仿照这个来做一个Claude Code，是一个很好的学习Claude Code， Agent的机会，同时也是一个练手Harness 工程的机会。具体请看笔记的Harness工程的Claw Code讲解。

泄漏发生后数小时内，社区迅速行动：有开发者连夜将核心功能从 TypeScript 移植到 Python（以规避 DMCA 版权风波），推送到 GitHub 后迅速成为有记录以来**最快达到 10 万星的仓库（Claw Code）**，随后又被用 Rust 重写了一遍。甚至有人用 Claude Code 本身生成了一个 PR，试图将全部泄漏源码提交回 Anthropic 的官方仓库。

一个讽刺性的版权争议也随之浮现：如果 Anthropic 声称的"80% 的代码由 AI 编写"为真，那么根据美国现行法律，AI 生成的内容不受版权保护——Anthropic 理论上没有 DMCA 下架的法律基础。

### 8.2 整体架构

掌握整体ClaudeCode的工作流程。在我们学习后面小节的时候，会有一个更清楚的理解。比如后面的

**4.4.3的记忆功能模块**：**主要**发生 图中第四步，不过 第三步 上下文装配也会涉及。

**4.4.4的Agent架构:** 发生在第四步：Agentic loop或者说React，也是系统的核心。

**4.4.5 权限系统和安全审查：**发生在第四步的工具调用整个步骤

![图片展示了Claude Code Agent全局工作流。从上到下依次为会话路由、输入处理、上下文装配、Agentic Loop（核心循环）和回合收尾。其中，Agentic Loop包含上下文治理、调用模型、判定是否需工具、执行工具等步骤。该图与文档中介绍的对话Agent完整流程相呼应，直观呈现了从会话路由到回合收尾的各阶段及核心循环内容，帮助理解对话Agent的工作流程。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/KTvObnfT8owboOx68B8crxm7ntf.png)

一个对话 Agent 的完整流程，本质上就是回答两件事：**一次用户输入要按什么顺序流过哪些模块** 与 **跨轮次要持久维护哪些状态**。结合上面这张 Claude Code 工作流图，从上到下五个阶段依次是：

**① 会话路由**

按 sessionId 找到（或新建）一个会话上下文，把这次请求挂到对应的会话状态上——包括消息历史、累计用量、权限模式、记忆等。新会话就 bootstrap 一份默认状态，老会话从持久化的 transcript 里恢复。这一步本质就是"先把你是谁、之前聊过啥、能用哪些权限"这些信息准备好。

**② 输入处理**

把多种来源（UI、CLI、SDK）的原始输入**归一化**成统一的消息格式，同时做意图分流：解析 slash command（`/compact`、`/model` …）、@ 文件引用、粘贴的图片/附件、命令输出等。本地命令能直接处理的就短路掉，不浪费一次模型调用。

**③ 上下文装配**

把这一轮要喂给模型的"完整提示"拼出来：System Prompt（身份、规则、当前模式）+ 工具定义（哪些 tool 可以调）+ 用户/项目级记忆（CLAUDE.md、偏好）+ 环境信息（cwd、git status、相关文件快照）+ 历史消息。重点是这些都是**动态装配**的，会根据当前模型、权限、启用的插件实时变化。

**④ Agentic Loop（核心循环）**

> 整个系统的核心，也可以说是React的实现方法，面试考点如：React如何实现，就可以借鉴这里。

这是图里红框那一块，也是 Agent 之所以叫 Agent 的地方。一个 `while (true)`，每轮四件事：

1. **上下文治理**：进循环先看 token 预算，超阈值就压缩——把旧消息摘要化（auto-compact），腾出窗口继续聊。
2. **调用模型**：流式发请求，边收边把 partial 结果推给 UI。
3. **判定是否调工具**：看返回的 `stop_reason`。模型说 "end_turn" 就跳出循环；说要 "tool_use" 就进下一步。这就是 ReAct 的 Thought → Action 决策点。
4. **执行工具 → 结果回填 → 回到第 1 步**：按模型给的 tool_use 调度工具（文件读写、Bash、MCP、子 Agent），先过一遍权限校验，结果作为 tool_result 追加到消息里，然后继续下一轮。

**退出条件**：模型主动 end_turn / 达到 maxTurns / 预算耗尽 / 用户中断 / 不可恢复错误。

**⑤ 回合收尾**

输出最终 assistant 消息；汇总这一轮的 usage、cost、耗时、停止原因；把 transcript 落盘；触发 Stop Hook 和通知。本质就是把第 ④ 步循环里产生的副作用收拢、上报、持久化。

**横切关注点（图例里的三条虚线）**

> 这部分的内容不属于输入-输出这个工作流，是伴随在整个系统中的其它功能。

- **用量统计**：贯穿 ②③④⑤，每次调模型/调工具都在累加，最后在收尾结算。
- **Hook 钩子**：PreToolUse / PostToolUse / Stop / SessionStart 等切面，在输入处理、工具执行前后、收尾几个点位被触发，用户可以插自定义逻辑。
- **落盘与通知**：transcript 持久化、文件快照、桌面通知，都是异步副作用，不阻塞主循环。

---

#### 8.2.1 面试真题讲解

1. 如何让你从0设计一个对话Agent的流程，核心状态有哪些？

(选自[腾讯2026年4月暑期实习大模型开发](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)）

> 其实就是理解了上述整体架构后，你可以套用CC的架构来讲。当然你也可以套用Openclaw的架构来讲。Openclaw也用了React, 上面有gateway。总之你要用一个完整成熟的架构来回答，设计的流程肯定是比较成熟完整的。

我会把一个对话 Agent 拆成五步流水线：**会话路由 → 输入处理 → 上下文装配 → Agentic Loop → 回合收尾**。

**会话路由**：按 sessionId 把请求挂到对应会话上，恢复历史消息、用量、权限模式、记忆。

**输入处理**：把多来源的输入归一化成统一消息，解析 slash command、@ 引用、附件，本地能处理的直接短路掉。

**上下文装配**：动态拼出这一轮要喂给模型的完整提示——System Prompt + 工具定义 + 长期记忆 + 环境上下文 + 历史消息。

**Agentic Loop**：一个核心循环，每轮先做上下文裁剪/压缩，再调模型，看 stop_reason 决定退出还是调工具；调工具就先过权限校验、再执行、把结果回填进消息继续下一轮。退出条件是 end_turn / 达到轮数上限 / 预算耗尽 / 用户中断 / 错误。

**回合收尾**：输出最终回复，汇总 usage 和 cost，落盘 transcript，触发 Stop Hook等操作。

1. ReAct机制在生产环境里该怎么实现?

(选自[腾讯2026年4月暑期实习大模型开发](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)）

> 不论是Openclaw还是ClaudeCode，里面都用的React，大概的实现方法也类似，我们把它抽象成这样。这个图可以作为React的标准工程实现流程。

![图片展示了ReAct模型的Agentic Loop流程。首先接收输入，包括用户Prompt、System Prompt、工具定义、对话历史等。接着模型推理，Claude分析上下文，生成回复，回复为文本和工具调用请求（可选）。然后判断是否调用工具，若否则返回最终结果；若是则执行工具，Harness执行工具，收集结果（仅限检查→执行→返回结果），最后结果回注，将工具结果追加到对话历史。该图与文档中介绍ReAct模型在生产环境中的循环流程内容相呼应。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/FsPsbAyQdoLIlnxxWywcWatNnvf.png)

生产环境里我会把 ReAct 设置成一个循环流程：

**1.先装配上下文**

每一轮模型调用前，系统要把用户输入、历史消息、System Prompt、工具定义、权限信息、环境状态一起组装好，形成当前这一轮的完整上下文。

**2.让模型决定下一步**

模型不是直接随便输出文本，而是要么返回最终答案，要么返回一个结构化的工具调用请求，比如要调用哪个工具、参数是什么、调用目的是什么。

这一步对应 ReAct 里的 Reasoning / Action 决策。

**3.由系统执行工具，而不是模型自己执行**

模型只能“申请调用工具”，真正执行的是外部 harness / runtime。

执行前要做权限检查、参数校验、风险判断、超时控制、重试控制。比如文件写入、数据库查询、外部 API、Shell 命令，都不能只靠模型一句话就执行。

**4.把工具结果回填给模型**

工具执行完以后，结果会作为 observation / tool_result 加回对话历史里，再进入下一轮模型调用。模型基于新结果继续判断：是继续调工具，还是给用户最终回答。

**5.设置退出条件**

不能让 Agent 无限循环。生产里必须有明确的退出条件，比如模型返回 final answer、达到最大轮数、token 预算耗尽、工具失败次数过多、用户中断、权限拒绝等。

---

### 8.3 记忆功能

> 其实大家看各种Agent的开源项目，每个Agent项目，我们都需要关注最重要的几个点，也是Agent项目的核心：比如记忆，架构，Agent的交互对吧。所以不管看哪个Agent项目，都该特别解析关注这个记忆模块。我们在笔记的openclaw部分已经解析了小龙虾的记忆功能，今天我们来看看ClaudeCode的记忆功能，二者对比，体会成熟的Agent项目的记忆功能背后的设计哲学。

学习一个 Agent 的记忆模块，可以重点从以下几个问题入手：

\- **它由哪些部分组成？**

\- **它是如何运行的？**例如加载、写入、压缩、恢复等流程。

\- **各部分分别负责什么功能？**

\- **信息以什么格式存储？**例如 \`.md\`、\`.jsonl\`、内存对象等。

\- **这些信息存在哪里？**是在内存中，还是落到磁盘文件里？

\- **整体设计理念是什么？**它是为了让模型更聪明，还是为了让系统更可恢复、更可审计？

教大家一个小技巧，如果你没有设计Agent的一些思想，那么在你的Agent系统（简历上），加上这么一条：xxx。基本照抄ClaudeCode的设计理念，写在简历上，面试的介绍项目大概讲一下，面试官大概率会问设计的细节，然后你就可以照着本节的笔记去讲解。本节笔记也会引入真实的面试真题，感受面试官对于你的记忆系统是怎么提问的？可以用这些面试真题来体会自己有没有真正理解。当然如果你更有想法，在消化了本节内容后，可以结合自己项目和思想，去改进你的记忆系统（但前提是你消化了这个业内的标杆实现，如果你没有消化就自己设计，那你还不如照抄呢）

从宏观上，我们从这个图来了解CC的存储系统。其实我翻了大量的参考资料，很多资料的解析，其实只解析了CC的左半边部分，甚至只解析了左半边记忆系统里面的某一层。但是我这里加入了右边，Transcript，因为不讲这个，讲不清楚ClaudeCode是如何恢复对话，做上下文重建的（这也是面试问题，另外你要是用这一套记忆系统放在你的项目，你必须从各个角度理解透彻，因为面试官会从各个角度来提问）

从宏观上看，Claude Code 的上下文持久化体系可以分成两大部分：**Memory 记忆系统** 和 **Transcript 会话账本**。如下图：

\- 左侧的 **Memory 记忆系统**，主要负责保存会影响模型后续理解和行动的语义材料。它包括 CLAUDE.md 族、对话上下文、Session Memory 和 Memdir 持久记忆。

\- 右侧的 **Transcript**，更像完整的会话流水账，用来记录用户消息、助手回复、工具调用和工具结果。它主要服务于恢复、回放、审计和会话续接。

![图片展示了Claude Code的上下文持久化体系，分为四类Memory和Transcript。Memory包括CLAUDE.md族人写的长期规则、对话上下文、Session Memory及Memdir持久记忆，分别以文件、内存消息等存储形式；Transcript为原始会话流水账，以.jsonl transcript等格式存储，用于保存完整会话事实，用于恢复、回放、审计与会话续接。该图与上下文紧密相关，是对上下文持久化体系的详细说明，是4.4.3.1部分的图示。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/Gel4bFFaAo3L0txxtSacu5UcnOc.png)

下面4.4.3.1 就是对该图左边的这一部分进行详细讲解。

同时附上一张完整的图片，包含了四层记忆和压缩功能，CC整体的运作图。

![图片展示了AI Coding Assistant的记忆系统运作图。上方有指令文件、会话上下文、会话记忆和持久记忆四部分。指令文件和会话上下文通过LOAD进入系统，会话上下文还连接到Sonnet。系统生成系统提示后，通过压缩（包括预算、多连接、自动压缩、块、反应等）和写入（包括提取记忆、会话更新、AutoDream）环节，最终实现代码搜索实时化、偏好持久化。该图与上下文对记忆功能的详细讲解相呼应，直观呈现了系统运作流程。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/CEqyb2TlQoORuixJBX3c8tbXnHb.png)

#### 8.3.1 四层记忆

1. **五层指令文件（CLAUDE.md 族）—— 人写的规则**

> 指令文件其实在CC的核心用法就讲过，这里Claude.md 系列文件的维护，需要人工维护的。

![图片展示了ClaudeCode指令文件的五层记忆体系。从上至下依次为：企业级的`/etc/claude-code/CLAUDE.md`，管理者是IT部门/管理员，作用范围全公司开发者；用户级的`~/.claude/CLAUDE.md`，开发者个人偏好；项目级的`./CLAUDE.md`，团队共享项目约定；规则级的`./claude/rules/*.md`，模块化细粒度规则；本地级的`./claude.local.md`，不提交到Git的私人笔记。该图与上下文紧密相关，直观呈现了指令文件维护的层次结构。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/QuQhbqoHAoFWXlxzgdpcVaTrnSg.png)

CLAUDE.md 族采用五层记忆体系：

- **企业级**：`/etc/claude-code/CLAUDE.md`

管理者是 IT 部门 / 管理员，作用范围是全公司开发者。特点是强制执行，个人无法覆盖。

- **用户级**：`~/.claude/CLAUDE.md`

管理者是开发者个人，作用范围是该用户所有项目。特点是跨项目的个人偏好。

- **项目级**：`./CLAUDE.md`

管理者是团队 / Tech Lead，作用范围是当前项目所有成员。特点是提交至 Git，团队共享。

- **规则级**：`.claude/rules/*.md`

管理者是团队 / 个人，作用范围由 Glob 模式限定。特点是模块化、条件化触发。

- **本地级**：`./CLAUDE.local.md`

管理者是开发者个人，作用范围仅当前工作区。特点是不提交 Git，通常自动加入 `.gitignore`。

从上至下，适用范围逐渐收窄，内容颗粒度日益精细，管理灵活性也随之递增。

你可能会问，当这五层内容，冲突了怎么办？

Claude Code 不会像配置系统那样用下层文件把上层文件整段替换掉，而是把企业级、用户级、项目级、规则级、本地级这些 `CLAUDE.md` **内容一起读出来**，**按一定顺序合并进同一个上下文里，让模型同时看到多层规则**。发生冲突时，普通规则主要靠**模型根据“更具体、更贴近当前任务、位置更靠后/更新”的信息来判断该听谁**，比如用户级说 4 空格、项目级说 2 空格，项目级更具体，通常会被采纳。但这仍是认知层的软优先级，不是代码级覆盖；真正的硬约束要靠权限、Hooks、Managed Settings 这类系统机制保证。

这里是一个面试问题考点，请看 [腾讯AI Agent暑期实习，面试问题2：如果用户和AI对话生成问题本身有冲突，系统应该怎么处理](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)

> 更多参考资料：讲解CC的MD的原则，可以查看 《ClaudeCode Harness之道》（黄佳著）第2章 2.2小节（书籍资源要你自己找哈）。

---

1. **对话上下文—— 短期记忆**

> 就是大模型多轮对话的数组，每个Agent都有。

当前对话的消息数组，所有 LLM 应用都有。Claude Code 的特别之处在于配套了一套多层压缩策略来管理它（见 3.1存储时，由后台 agent 更新），主要服务本次 compact。

---

1. **持久记忆（Memdir）—— 跨会话的长期记忆**

最核心的长期记忆系统，位于 `~/.claude/memory/`。存 4 类信息：

- **`user`**：用户角色、偏好、技能水平。例："偏好函数式风格"、"是后端工程师"
- **`feedback`**：用户对 AI 的纠正和确认。例："上次用 forEach 被要求改成 map"
- **`project`**：项目目标、决策、截止日期。例："Q3 要迁移到 TypeScript"
- **`reference`**：外部系统指针。例："Bug tracker 在 Linear：xxx"

注意这里**故意不存代码事实**（如"函数 X 在第 30 行"），因为代码会变但记忆不会自动更新，过时的代码记忆会变成危险的误导。代码相关的事实永远用 grep/glob 实时搜索，只有人的偏好和判断才值得持久化。

**存储结构：**

```Plain Text
~/.claude/memory/
├── MEMORY.md              ← 索引文件（每次会话自动加载）
├── user_role.md           ← 主题文件：用户角色
├── feedback_testing.md    ← 主题文件：测试相关反馈
├── project_migration.md   ← 主题文件：迁移计划
└── reference_tracker.md   ← 主题文件：外部系统指针
```

`MEMORY.md` 是**索引**，不存记忆内容本身——每行只有一个指向主题文件的链接和一句话摘要（≤150 字符），格式如 `- [用户角色](user_role.md) — 后端工程师，偏好函数式风格`。上限 200 行 / 25KB。

实际的记忆内容存在各个**主题文件**中，按语义主题命名（不是固定 4 个文件），每个文件带 YAML frontmatter 声明 name、description 和 type（对应上面的 user/feedback/project/reference 四种类型）。查询时系统通过扫描 frontmatter 来判断哪些文件与当前对话相关。

**团队记忆：** Memdir 下有 `team/` 子目录，支持跨用户共享的项目记忆。会话开始时自动同步。敏感信息（API 密钥等）禁止存入。Feature flag `TEAMMEM` 控制。

**写入时机**：用户明确说“记住”时立即写；或者一轮完整回答结束后，也就是模型给出最终回答、没有继续调用工具时，系统会触发后台 **extraction agent**。它会看最近一段对话里有没有值得跨会话保存的内容，也就是 durable memory。

**召回策略：**

Claude Code 的长期记忆召回是这样的：**每个用户回合后台发起一次检索**，由一个**更便宜的小模型**（Sonnet）拿用户这句话去和每条记忆的一行 description 做语义相关性匹配，最多挑出 5 条"确定有用"的注入上下文（常常是 0 条，挑不准就不选）。注入前还有多道闸门——**单字输入、超会话预算、已注入过或主模型已读过的**，都会被跳过，所以不是每回合雷打不动灌 5 条，而是按相关性 + 去重 + 预算动态决定。此外 MEMORY.md 索引始终常驻上下文，主模型也能按需主动去读对应记忆文件。

> 召回策略这里，[202605 安克暑期实习](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQCX8duS2xWpCpkbqEh89Qf) 面经中有问到。 

> 想深入学习Memdir? 其实对于这个Memdir，它的设计的理念，层级，可以看[这里](https://lintsinghua.github.io/#ch06)

---

#### 8.3.2 Transcript会话账本

通常来说，很多书籍，文章解析ClaudeCode的时候，讲记忆功能，只会讲4.4.4.1的四层记忆，不会讲这个一小节。但是为什么要讲，是因为如果你要把这一套记忆系统，用在你的项目，和面试官聊的时候，你必须理解这一整套，你的Agent存了哪些东西，面试官可能会问你，会话是如何重建的，恢复的？你必须要理解这一层的存储，因为会话重建，回滚的方法，通常不是通过4.4.3.1的记忆实现的。而是通过专门的会话账本存储的。学习这一小节，有助于理解整个Agent体系的全局架构，面试官问你：**你的系统存了哪些东西？你如何恢复上下文的问题？本节会发挥很大的帮助。**

大家可以看看Keep公司暑期实习面经，通过这个面经，你可以感受到，你学习这个小节的重要性。**从面试官主动问的概率上，该小节被问到的概率不大**，这个小节的核心思想是给大家建立一个意识，日志如何恢复的。**当你在用这一套包装简历的时候，那你务必想清楚这一小节**，请你也想清楚你的系统里：

**Transcript存了什么？**

**当刷新恢复上下文时怎么做的？**

**当返回到某个Checkpoint的时候怎么做的？**

这些具体的细节还是依赖于大家自己，如果你要用这一套包装，最好能做一下，不能做也想清楚这些问题。我也给到大家对应的参考资料，大家可以借鉴LangGraph的恢复功能弄清这些问题，本节只介绍CC大概的思路（具体实现各个产品不一样，但宏观思路是一样的：记忆系统让Agent聪明+日志系统让Agent重建会话）

**功能介绍**

Transcript 会话账本是 Claude Code 的**完整会话记录层**，用来保存一次会话中**真实发生过的消息与执行过程**。它**记录用户输入、助手回复、工具调用、工具返回结果、compact boundary、错误与恢复痕迹等内容**。它的核心功能不是“提炼记忆”，而是保留原始事实：让系统之后可以**恢复上下文、续接会话、回放执行轨迹**，并在出问题时用于审计和排查。

**写入时机**

写入时机是在会话运行过程中持续发生的。在 query loop 里收到新的用户消息、助手消息、工具结果或 compact boundary 后，会调用把这些内容写入 Transcript。也就是说，Transcript 不是最后才生成的总结，而是随着会话一步步追加的执行账本

**存储格式**

JSONL。每一行都是一条结构化记录，例如一条用户消息、一条模型回复、一条工具调用结果，或者一条系统状态记录。相比 Markdown，JSONL 更适合机器读取、追加写入和恢复会话。

**恢复功能**

恢复功能指的是 Claude Code 可以根据之前保存下来的会话记录，把一个旧会话重新接起来继续工作。它依赖的不是模型“凭空记得”，而是读取之前的 Transcript 会话账本，把用户消息、模型回复、工具结果、压缩边界和相关状态重新整理成可继续对话的上下文。这样用户下次打开同一个会话时，系统不需要从零开始，而是能知道之前聊到哪里、做过什么、哪些工具已经返回过结果、当前任务处在什么阶段。

**重放功能**

重放功能指的是系统可以根据 Transcript 中按时间保存的记录，回看或复现一次会话中发生过的过程。因为 Transcript 记录的是完整流水，而不是最终总结，所以它可以展示用户什么时候说了什么、模型什么时候做了什么决定、调用了哪些工具、工具返回了什么、在哪个位置发生了中断或压缩。重放的重点不是让模型重新推理一遍，而是让人或系统沿着已有记录理解“当时到底发生了什么”。

这一小节的内容，也可以参考 [虾皮2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFOe7o39Bna0casHuXLnIMb)，有较多关于重建的讨论。

同时，在PI agent的讲解章节，关于[会话存储](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#F2aZdWlEyowAvYxCWQfcsFcGnld)，Session机制相关内容更详细，也可以参考这里。

---

#### 8.3.3 上下文组装

每轮对话开始时，系统从上述 4 种存储中**组装完整的上下文**注入 system prompt。

**指令文件的加载**

所有层级的 CLAUDE.md **都会被拼接在一起**注入，不会互相覆盖。但拼接顺序有讲究——源码注释写道：*"Files are loaded in reverse order of priority, i.e. the latest files are highest priority with the model paying more attention to them."* 这利用了 LLM 的一个已知特性：**模型对 prompt 末尾的内容天然给予更高注意力**（recency bias）。因此排在后面的文件在实践中"优先级更高"。

加载顺序（排在越后面，模型越关注）：管理员全局 → 用户全局 → 项目级 → 本地私有。举例：如果管理员规则说"用 npm"，但项目级 CLAUDE.md 说"用 pnpm"，模型会倾向于遵循后者。

**持久记忆的加载**

1. `MEMORY.md` 前 200 行**每次会话自动加载**到 system prompt
2. 用 **Sonnet**（小模型，不是主模型 Opus）扫描所有记忆文件的标题和 frontmatter 描述，选出**最多 5 条**最相关的，作为 `relevant_memories` 附件注入上下文
3. 排除本次会话已召回过的记忆（避免重复）
4. 超过 1 天的记忆自动加**过期警告**：*"这条记忆是 N 天前的... 关于代码行为的声明可能已过时，请先验证。"*
5. 会话总预算 60KB

值得一提的是，记忆召回没有使用 RAG（检索增强生成）。Boris 在播客中透露，早期版本曾尝试过本地向量数据库 + 云端 embedding 的 RAG 方案，但遇到了多个问题：代码修改后索引不同步（新写的函数搜不到）、索引的权限管控复杂（谁能访问、如何防止越权）。最终发现**agentic search（模型自主调用 glob + grep）全面优于 RAG**——Boris 的原话是 *"agentic search just outperformed everything, and when I say agentic search, this is a fancy word for glob and grep."*

#### 8.3.4 压缩

> 压缩是Agent里面的一个核心技巧。我觉得这里面的内容相当复杂，作者在这里也重构过几次，如果你看到的内容和视频有不一样的地方，说明内容重构过了。我也参考了好几个资料（我会附在本节参考资料里），但是其实这些参考资料里讲的都不太一样。我重构的思路，加入了更多的图片讲解，同时我避免讲得过于复杂，因为里面太深奥了，如果写得太复杂反而会弄晕。我的总结是针对于面试问题的，我希望本章内容足够回答面试问题，我也会穿插很多面试真题在其中。如果你想更深入研究，可以去看我给出的参考资料（当然我给的参考资料不同参考资料对这一块讲解也有所不同，我认为不用深究，理解原理知道如何运用到自己项目就好）

对话越来越长，上下文窗口终会被填满。Claude Code 设计了一套**四层压缩流水线**，在每轮查询循环中按固定顺序依次执行，每层有独立的触发条件——不是每层每次都触发，而是逐层检查、按需执行，越往后越激进。

这一张图比较清晰地展示了本小节要讲的全部内容，后面会详细展开, 重点关注：

压缩分成4个层级，从弱到强。

每层压缩的触发条件，同步还是异步，何时触发，怎么触发的？

最后一层有一个熔断机制：避免死循环。

![图片展示了Claude Code四级上下文压缩策略，从成本递增、上下文压力递增方向展开。Level 1为Snip裁剪，无LLM，标记痕迹工具结果，成本为0，同步执行，用户手动精简删除。Level 2为MicroCompact，无LLM，规则驱动清理，成本较低，触发条件为未提交同步执行，缓存感知。Level 3为Collapse压缩，部分LLM，周期性Spam摘要，成本中等，触发条件为上下文水位、90%的90%commit未提交、95%的blocking，禁止使用spawn。Level 4为AutoCompact自动压缩，完整LLM对摘要，成本高，同步执行，自动触发，有熔断机制。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/FtusbDhkToyGpixpvw8cU3dYnJc.png)

---

##### 8.3.4.1 层一：Snip裁剪

**是什么？**

Snip 是最轻量的清理方式，主要用于清除已经不再需要的旧工具结果，比如 Read、Bash、Grep 等输出。它不调用 LLM，只把大段工具结果替换成简短标记，从而释放 token。

**如何触发？**

自动触发。系统根据工具结果数量、缓存状态、时间间隔或 token 阈值，自动清理旧工具结果，不调用 LLM。用户无法通过提示词精准指定删除某条工具结果。

**实现原理**

Snip 不删除整条消息，而是保留消息结构，系统将其中的工具调用结果替换为简短的标记文本（如 `[Old tool result content cleared]`），从而释放令牌空间。这样既能减少 token，又不会破坏 tool_use 和 tool_result 的对应关系。

**同步/异步？**

同步执行，成本接近 0。

---

##### **8.3.4.2 层二：MicroCompact（微压缩）**

**是什么？**

MicroCompact 是基于时间触发的大规模工具结果清理。当检测到距离上一次助手消息的时间间隔超过配置阈值时，意味着服务端缓存已过期，此时无论内容多么重要，全量重写都无法避免 -- 既然如此，不如在请求之前主动清除旧的工具结果，减小重写负载。

**如何触发？**

自动触发，常见条件是缓存过期、时间间隔达到阈值，或请求处理时发现旧工具结果已经不适合继续保留。在你发送请求后，CC处理你的任务前，如果检测到条件允许，自己就做了微压缩。

**实现原理**

系统按工具类型白名单筛选可压缩内容，例如 Read、Bash、Grep、Glob、WebFetch 等。通常会保留最近 N 个工具结果，把更早的结果替换为清除标记。

**同步/异步？**

同步执行，发生在请求处理链路中，发起模型请求前完成。

---

##### **8.3.4.3 层三：Collapse（折叠）**

**是什么？**

Collapse 是上下文重构级压缩。当启用 Context Collapse 特性时，系统会在上下文使用率达到 90% 时开始提交（commit）压缩操作，在 95% 时阻止新的 spawn。这一级别的设计理念是将上下文管理从"被动压缩"转变为"主动重构"。Collapse 模式会抑制自动压缩的触发，因为两者在 93% 的临界点会产生竞争。Collapse 作为更精细的上下文管理系统，拥有更高的优先级。

**如何触发？**

自动触发，主要由上下文压力驱动。大致在上下文使用率约 90% 时开始 commit 折叠，在约 95% 时进入 blocking，阻止继续扩张或创建新的子任务。

**实现原理**

Collapse 会选择相对稳定、低风险的历史片段，让专门的 context-collapse 子 agent 生成局部摘要。之后请求模型时，系统不直接发送完整历史，而是投影成类似：

```Plain Text
原始历史：A B C D E F
折叠视图：A B <collapsed summary of C-D> E F
```

原始消息仍然保留在 transcript 中，折叠摘要作为提交记录保存，可以跨轮恢复。

**同步/异步？**

> 也就是在真正执行的时候，他还是同步阻塞的，但是可以异步准备一下它的摘要。比如说当信息变更成A,B,C,D的时候，已经开始总结C,D的summary了，E,F同时继续，这是异步的。但是真正压缩的时候，将C,D替换成summary的时候，是同步的。

混合模式：局部摘要可以提前异步准备；真正发请求前，系统同步应用折叠视图。

---

##### **8.3.4.4 层四：AutoCompact（自动压缩）**

**是什么？**

AutoCompact 是最终兜底机制。当上下文接近上限时，系统自动触发压缩，避免请求因为上下文过长失败。它的成本最高，因为通常需要 LLM 参与摘要。

**如何触发？**

自动触发。典型阈值是 effective context window - 13K tokens，约等于上下文使用率 93%。另外，如果模型返回 context overflow / prompt too long，也可能触发恢复性压缩。

**实现原理**

触发后有两个子策略，**先尝试轻量的，不行再用重量的**：

1. **Session Memory Compact（轻量）**：用已经由后台代理提取好的 Session Memory 文件作为摘要，保留最近 **10K\~40K tokens** 的原始对话（至少保留 5 条含文本的消息）。**不需要额外的 LLM 调用**，所以很便宜。
2. **Full LLM Compact（重量）**：把整段对话发给 LLM 做结构化摘要。摘要输出上限 **20K tokens**，包含 9 个固定段落：

   - 核心请求
   - 关键概念
   - 涉及文件列表
   - 代码错误与修复
   - 问题解决过程
   - 所有用户消息
   - 待办事项
   - 当前工作
   - 下一步计划
3. 压缩后自动恢复文件上下文：压缩会丢弃旧消息，但会话期间所有被读过、写过、编辑过的文件都记录在 `readFileState` 缓存中（包括 agent 调用 FileRead/FileEdit/FileWrite/Bash 工具操作的文件，以及 memdir 系统和 Sonnet 预取自动加载的记忆文件）。压缩完成后，系统会从这个缓存中排除 CLAUDE.md 和 Plan 文件（它们有各自的恢复机制），再按最近访问时间排序，取最多 5 个文件从磁盘重新读取（不用旧缓存，确保内容是最新的），以每文件 ≤5K tokens、总计 ≤50K tokens 的预算注入到压缩后的上下文中，让模型不需要在下一轮重新读取这些文件就能继续工作。如果会话中没有操作过任何文件，则不会恢复。
4. **防御机制**：连续失败 **3 次**后触发熔断，不再尝试。如果压缩调用本身也报 prompt-too-long，会从最旧的消息开始截断，最多重试 **3 次**。

**为什么建议主动 `/compact`**

社区分析源码后的一个关键建议是：**主动使用 `/compact`，不要等系统自动压缩**（出自 "I Read 512,000 Lines of Leaked Claude Code" 视频）。原因很简单——自动压缩触发时，你无法控制保留什么，系统按自己的 9 段模板做摘要，可能会丢掉你认为重要的上下文。而手动 `/compact` 可以附带指令，比如 `/compact 重点保留决策和待办事项`，让 LLM 知道什么该保留。Boris 在播客中也提到自动压缩是实现"本质上无限上下文"（essentially infinite context）的核心手段，但这更多是系统兜底，用户主动管理上下文效果会更好。

---

##### **8.3.4.5 和Openclaw的对比**

> 这里我们不妨把两个架构的压缩策略对比。

OpenClaw只有一级压缩，但做得更精细：保留最近 \~20K tokens 原文不动，只压缩更早的旧消息，旧消息按 token 数分成多个块逐块总结，再合并成一个连贯摘要。压缩前还会静默运行一轮，提醒 Agent 把重要内容写入记忆文件（Pre-Compaction Memory Flush），防止关键信息随压缩丢失。压缩后结构：`[合并摘要] + [最近 ~20K tokens 原文]`。

Claude Code 则是**两级梯度设计**：轻量级的 Session Memory Compact 效果类似 OpenClaw（摘要 + 保留最近原文），但摘要不是现场生成的，而是后台子代理提前维护好的，所以不需要额外 LLM 调用、更省成本。只有轻量级扛不住时才上 Full LLM Compact——这一步更激进，把全部对话压缩成结构化摘要，旧消息全部丢弃。

核心差异：OpenClaw 一步到位但精细（分块 + 合并 + 预刷记忆），Claude Code 分两步走（先便宜后贵），用梯度换成本效率。

**下图是Claude Code 的压缩策略 vs Openclaw的压缩策略**

![图片展示了Claude Code和Openclaw的压缩策略对比。Claude Code采用两阶段梯度策略，当Token count > 167K时，先进行轻量级会话内存压缩，若不足则进行全LLM压缩，需调用LLM API。Openclaw则采用单阶段精细压缩，先预刷内存，再将旧消息分块，每块总结后合并，最终得到合并摘要和近20K token的原始内容。该图直观呈现了两者在压缩策略上的差异，与上下文对二者核心差异的说明相呼应。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/VyVYbaGevopcsVxeb69c9Uq0nXe.png)

##### **8.3.4.6 我的Agent需要这么复杂吗？**

大概率不需要。ClaudeCode面向全球规模生产流量，很多设计，是为了处理极端情况。

比如第二层微压缩，主要为了处理的是提示词缓存，这个和Anthropic的推理端缓存有关，我们大概率不用做。一般建议做的：工具要清理 + 失败停止重试+你的压缩过程保留哪些信息。

另外我分析了两个同学的面经，他们和面试官讲压缩的时候是异步压缩的，结果被面试官追问细节答不上来。其实根据我们小节讲的，在真正压缩的时候，都是同步的。但是压缩的时候依赖于一些异步执行（比如实时总结中间过程）的结果。这里注意一下。所以你最好别把你的项目压缩过程设计成异步的，弄得比CC还复杂，不想清楚面试还爱翻车。

##### **8.3.4.7 面试真题**

##### **8.3.4.8 参考资料**

我给了三个资料，他们对于CC压缩的分层层级分类都不一样，如我引言所说。以一种为准，掌握思想和原理，想清楚细节，用来对付面试题和设计项目就够了。 

1. [《解码 Agent Harness · Claude Code 架构深度剖析》第7章](https://lintsinghua.github.io/#ch07)（本节按照这本书的分类总结的）
2. [Claude Code 上下文工程：四層壓縮機制的源碼級拆解](https://ai-coding.wiselychen.com/claude-code-context-engineering-four-layer-compression/)
3. [Claude Code 底层逻辑分析：三级压缩系统，让 AI 用有限的上下文窗口做无限长的任务](https://cloud.tencent.com/developer/article/2653153)

---

#### 8.3.5 记忆写入

上面讲了 4 种存储和加载/压缩策略，但记忆是怎么**写进去**的？有 3 个写入机制：

1. **extractMemories（持久记忆提取）**

在每次完整查询循环结束后（模型给出最终回复、没有更多工具要调用时），由一个 Fork Agent 后台执行：

- 继承父对话的完整上下文，共享 prompt cache（不额外消耗 token）
- **严格权限沙箱**：只能读文件 + 只能写记忆目录，不能执行 bash、不能调 MCP、不能启动子代理
- 高效的 2 轮模式：第 1 轮并行读所有需更新的文件 → 第 2 轮并行写所有变更
- 有频率限制，不是每轮都跑

1. **Session Memory 更新**

对话 token 超过 10K 后启动，之后每 5K tokens 由后台 Fork Agent 更新一次结构化笔记文件。

1. **AutoDream（记忆整合）—— "睡眠整理"**

定期运行的后台代理，对持久记忆做整理、合并、去重、清理。灵感来自人类睡眠时整理白天记忆的过程。下图是AutoDream图片展示。

![图片展示了AutoDream记忆整合流程。上方有三个触发条件，分别是距上次整合≥24小时、≥5个会话、获取consolidation lock。下方是执行的4个阶段：Orient（读取MEMORY.md索引、浏览主题文件）、Gather（扫描日志、会话JSONL，缩小grep范围）、Consolidate（将新信息合并到主题文件、修正矛盾、相对日期）、Prune（保留MEMORY.md < 200行、移除过时条目、修剪冗余描述）。底部有“read-only code access, write-only to memory directory”及“dreaming”字样。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/DgOTbGxDQosr7XxZ8kgctHuMnzS.png)

**触发条件（三个门全部通过才执行）：**

1. 距上次整合 ≥ **24 小时**（最先检查，成本最低——一次 `stat` 调用）
2. 距上次整合 ≥ **5 个会话**
3. 获取 **consolidation lock**（PID 文件锁，防并发；超过 1 小时且 PID 已死则可回收）

**执行 4 阶段：**

- **Orient**：读取 MEMORY.md 索引，浏览现有主题文件，了解当前状态
- **Gather**：扫描每日日志和会话记录（JSONL），窄范围 grep，不穷举
- **Consolidate**：新信息合并到现有主题文件，修复矛盾，相对日期转绝对日期
- **Prune**：保持 MEMORY.md ≤ 200 行，删除过时条目，精简冗长描述

System prompt：*"You are performing a dream — a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly."*

整合期间**只读访问**——可以看代码文件，但只能写记忆目录。由 Fork Agent 执行，UI 底栏显示 "dreaming" 标签。

**三者对比：**

![这是ClaudeCode记忆功能相关的三者对比表格，对应8.3.5记忆写入的相关内容，分别对比了extractMemories、Session Memory、AutoDream三类功能的各项属性。表格中清晰列出了三项功能的定位、写入目标、生命周期、新增/更新条目方式等信息，还对操作性质、触发时机、频率等细节做了区分，其中AutoDream是定期整理已有持久记忆，仅进行组织已有信息而非产生新信息，执行时UI会显示“dreaming”标签，且需满足≥24日、≥5个会话的条件，仅读写memory目录的文件。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/ECjBbbgP3oT54LxqXRzc0azonyh.png)

#### 8.3.6 Claude Code vs OpenClaw：记忆设计思路对比

两者解决的是同一个问题——**有限上下文窗口下如何让 Agent 不失忆**，但设计思路有几处根本性的分歧。

**检索路线之争：Agentic Search vs RAG**

这是两者最大的分歧。Claude Code 明确**拒绝 RAG**，Boris 透露早期试过向量数据库 + embedding 方案，但发现代码修改后索引不同步、权限管控复杂，最终结论是让 Agent 自己调 glob + grep 实时搜索（agentic search）全面优于 RAG。OpenClaw 则走了完全相反的路——用 SQLite 建本地索引，向量语义匹配 + BM25 关键词匹配加权合并做混合检索。

本质上这是 **"每次多花点 token 换实时准确"** vs **"建索引省 token 但要维护一致性"** 的取舍。对 coding agent 来说，代码文件变化极频繁，索引的一致性成本很高，所以 Claude Code 选择了不建索引；而 OpenClaw 面向更通用的 Agent 场景（聊天、知识管理），记忆文件相对稳定，RAG 的收益更明显。

**压缩策略：梯度递进 vs 一步到位**

Claude Code 设计了 5 层压缩流水线，从温和到激进逐层升级——先清理工具输出碎片、再考虑缓存优化、然后才做 LLM 摘要、最后硬拒绝和兜底。大部分情况下前两层（不需要 LLM 调用）就能把 token 压下来，真正的 LLM 压缩是中低频事件。这是一种**用工程复杂度换成本效率**的思路。

OpenClaw 只有一级压缩，但流程更精细：划分保留区（最近 \~20K tokens 原封不动）、压缩区分块逐块总结、多块摘要再合并成一个连贯总结。每次触发都需要 LLM 调用，成本更高，但**实现简单、行为可预测**。

**记忆写入：自动化 vs 显式写入**

Claude Code 做了重度的写入自动化——三个后台 Agent 分工：extractMemories 每轮结束后自动提取持久记忆，Session Memory 持续维护会话笔记，AutoDream 定期整合去重。用户不需要主动"存档"，系统自动帮你把重要信息沉淀下来。

OpenClaw 更依赖显式写入。它的文档反复强调一个常见失误：*聊天中说的指令不会自动保存到文件——不写入文件就会被压缩丢掉*。作为补偿，OpenClaw 在压缩前有一个 **Pre-Compaction Memory Flush**——静默提醒 Agent 把重要内容写入记忆文件。但这本质上是"事到临头才保存"，而 Claude Code 是"一直在保存"。

**记忆加载：Push vs Pull**

Claude Code 是**系统层面硬编码**的 push 模式——每轮对话前，系统必定用 Sonnet（轻量小模型）扫一遍所有记忆文件的标题和描述，挑出最相关的几条，直接塞进上下文。主模型开始思考时，相关记忆已经摆在眼前了，不需要它主动去找。类比：**秘书在你开会前，把相关资料提前放在桌上**。代价是每轮都要占固定的上下文空间，不管用不用得上。

OpenClaw 是 pull 模式——系统不会提前塞记忆，而是把 `memory_search` 作为一个普通工具暴露给模型。模型在推理过程中自己判断"这轮要不要查记忆"，跟它决定要不要调 bash、要不要读文件是一样的逻辑。更灵活省空间，但风险在于**模型不知道自己不知道什么**——比如你上周说过"我讨厌用 forEach"，这条记忆存在文件里了，但今天聊到循环时模型可能根本没想到要去搜"用户的代码风格偏好"，就直接写了 forEach。Push 模式下这条记忆会被小模型提前捞出来，就不会犯这个错。

**设计哲学总结**

Claude Code 走的是**工程优化路线**：梯度压缩能省则省、后台 Agent 自动写入、小模型做筛选降低成本——处处体现"怎么用更少的 token 做更多的事"。OpenClaw 走的是**架构清晰路线**：四层对标计算机存储层次（硬盘→日志→内存→搜索引擎），每层职责明确，系统更易理解和调试。面试时两者结合讲，既能展示工程优化思维，又能体现架构设计能力。

#### 8.3.7 讲解视频

ClaudeCode记忆模块保姆级教学。这个视频讲了整个4.4.3小节，注意对于四层记忆这里，视频讲到memdir这一层是用来恢复上下文的，这里视频讲的不对，请大家谅解，文档已经更正过来了。

https://www.bilibili.com/video/BV1UHQhBFEJx/?vd_source=144bec9c3f54e465073138bed788be1b

这个视频是对于虾皮面试内容的讲解。里面有很大一部分是结合了CC的四层记忆讲解的真题，关于memdir的部分，该视频讲解的也是正确的。可以结合参考。

https://www.bilibili.com/video/BV1BkVk6DEx3/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

#### 8.3.8 相关面试真题

##### 8.3.8.1 如何避免记忆越写越脏？

> 可以从CC的Autodream机制来回答。

参考自[：202604 腾讯AI Agent暑期实习面经。](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)本题答案也整理在了里面。

##### 8.3.8.2 如果ClaudeCode会话压缩了以后，可以拿到历史记录吗？

> 这里的一个重点是理解ClaudeCode的存储是分成两层的： [4.4.3.1四层记忆](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnuVcIH1LBY9aM66z87ce7bb) 和 4.4.3.2 [会话账本](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcn17nK88mIIc42t6kU1fJFsc)。 

压缩后，模型默认看不到完整旧历史，只看到压缩摘要；但完整历史没有被删，仍在本地 Transcript JSONL 里，必要时可以再读。模型一般不会自动从账本里检索历史，除非明确需要并主动读取，它主要会从Memdir这一层级来检索一些长期记忆，比如用户的风格，身份。会话账本主要负责**持久化和重建**

该面试题选自  [虾皮2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFOe7o39Bna0casHuXLnIMb)

##### 8.3.8.3 你的项目是如何重建你的会话的？

> 参考[ 4.4.3.2 Transcript会话账本](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcn17nK88mIIc42t6kU1fJFsc)

我的系统中存在一个会话账本，在 query loop 里收到新的用户消息、助手消息、工具结果或 compact boundary 后，会调用把这些内容写入其中。

当需要重建会话时，系统会读取之前的 Transcript 会话账本，把用户消息、模型回复、工具结果、压缩边界和相关状态重新整理成可继续对话的上下文。这样用户下次打开同一个会话时，系统不需要从零开始，而是能知道之前聊到哪里、做过什么、哪些工具已经返回过结果、当前任务处在什么阶段。

该面试题选自  [虾皮2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFOe7o39Bna0casHuXLnIMb)

##### 8.3.8.4 你的项目长短期记忆是如何存的？

> 假装我的项目是CC,现场根据CC的记忆模块包装。

我的项目的**短期记忆**，只是保存在内存中的，不需要存储成文件。

**长期记忆**主要是**以Markdown形式存储**。首先一份文件存储用户定义的指令性规则（灵感来源Claude.md)。另一份文件会存储长期记忆，包括用户**画像，风格等对话中提取的需要持久化的信息**。会存一份索引文件（Memory.md），和对应的记忆文件，每次AI先加载索引文件，需要使用对应的记忆时，再根据索引文件找到原文进行拼接。

**同时还会**存储一份JSONL文件，保留着整个会话的历史，用于对话恢复，重建，节点回退。

该面试题选自  [虾皮2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFOe7o39Bna0casHuXLnIMb)

##### 8.3.8.5 你的项目长期记忆存哪些东西？

> 假装我的项目是CC,现场根据CC的记忆模块包装。基本项目写了都会有记忆功能。可以用来回答你的项目长期记忆存什么？以及理论知识：长期项目应该存什么？

在设计上，我的项目在长期记忆里会明确过滤并**排除**那**些可以通过代码、Git 历史或直接检索就能推导出的内容**（如底层代码模式、具体架构细节等，避免污染）。我们只持久化存储无法从当前项目状态直接推导出的**四类核心高价值信息：**

- **用户画像**：存储用户的背景、角色与专业领域（如 “深度 Go 专家但 React 新手”），以便未来的协作和解答深度能精准匹配其认知模型。
- **交互反馈 ：**记录用户明确给出的行为偏好或成功路径确认（如 “不要 Mock 数据库，使用真实 DB”）。这不仅能避免模型未来犯同样的错误，同时能固定已被验证的最佳实践，防止模型行为漂移。
- **项目动态** ：记录正在进行的工作目标、决策缘由或非技术性约束（如 “因法律合规审计而重构 Auth 模块”），确保大模型在提出建议时具备对齐现实背景的上下文。
- **外部索引**：记录关联外部系统的定位指针与用途说明（如 Linear 缺陷追踪看板、Slack 协作频道或故障排查的 Grafana 监控面板），实现跨系统的高效协同寻址。

该面试题选自[ 安克2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFgaf8SfynnUywNvQWY4lYd)

##### 8.3.8.6 你的项目压缩是怎么做的/ClaudeCode的压缩机制是怎么做的？

> 在 [虾皮2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFOe7o39Bna0casHuXLnIMb) 和 [安克2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFgaf8SfynnUywNvQWY4lYd) 都有讨论如何做的压缩，是同步还是异步的？这里背景都是同学项目设计了压缩，和面试官讨论。最后讨论都没讨论清楚。我想说的还是，你要么借鉴CC，纯用它的理论复用，要么在他之上做设计，取长补短，但一定想清楚细节。 我也专门重构了CC压缩的笔记，专门说明CC的压缩是同步异步的？

在设计上，我的项目参考了 Claude Code 的实践，设计了一套**由弱到强、四层渐进式的压缩流水线**。在每轮交互前，系统会按需依次检测并执行。项目里面**压缩组装与替换行为必须是同步阻塞的**；但**中间高开销的摘要提炼大量依赖后台异步的提前筹备，从而形成“异步准备、同步应用”的混合模式。**

具体四层压缩管理策略如下：

- **第一层：Snip 裁剪（同步执行）**

  - 触发与原理：最轻量的工具结果清理，不调用 LLM（成本接近 0）。当内部裁剪策略达到触发条件时，系统同步将历史对话中的旧工具调用结果（如 Read、Grep、 Bash 的冗余输出）替换为简短标签（如 [Old tool result content cleared]），保留消息结构和关联关系。用户无法通过提示词精准指定删除某条工具结果
- **第二层：MicroCompact 微压缩（同步执行）**

  - 触发与原理：**基于时间周期自动触发。当检测到距离上一次交互的时间间隔超过预设阈值**（意味着服务侧的 Prompt 缓存已过期，大段重写势必无法避免），系统会在发送新请求前，同步根据工具白名单，清除更早期的工具执行结果以减小重写和网络开销。
- **第三层：Collapse 折叠（混合模式）**

  - 触发与原理：上下文重构级中等压缩，**在上下文压力达到 90% 时开始 commit。**
  - 混合特性：它是典型的混合机制。高风险和变动不频繁的历史片段会提前派遣专门的子 Agent 在后台异步提炼出局部摘要（Summary）。而在真正发起 API 请求前，系统同步应用折叠视图，替换原始历史：`A B <collapsed summary of C-D> E F`。
- **第四层：AutoCompact 自动压缩（同步阻塞 + 异步后台辅助）**

  - 触发与原理：最底层的强力兜底机制，**通常在上下文使用率达到 93% 临界点或遇到 API 溢出报错时触发**。包含由浅入深的两套策略：
  
    1. Session Memory Compact（轻量，零 LLM 成本）：首选方案。直接利用后台通过子代理异步持续提炼生成好的会话状态卡片文件（Session Memory）作为摘要，仅保留最近 15KTokens 左右的原文。
    2. Full LLM Compact（重量，调用 LLM）：若上一方案失效，则同步调用 LLM 将全部历史重构为包含“核心请求、待办事项、问题解决过程等”9 个核心维度的极致结构化摘要。
  - 重平衡机制：压缩完成后，为防模型历史空白，系统会从 `readFileState` 缓存中按最近访问时间提取前 5 个操作过的文件，同步重新读取最新的物理内容注入上下文（文件上下文自动恢复机制）。
  - 防御机制：提供断路器，限制连续 AutoCompact 失败达到 3 次时触发熔断，拒绝对同一个死循环节点重复产生无意义的 API 账单开销。

> ⚠ 这个是CC的压缩策略，我在笔记：[我的Agent要做这么复杂吗？](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnSorsdKrcHiuqCWpcJdj61d) 写了，如果你自己设计压缩策略，哪些要保留，哪些可以删除。如果问题是你的项目怎么的压缩，可以在此问题答案上适当简化。

该面试题选自[ 安克2026暑期实习面试](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnFgaf8SfynnUywNvQWY4lYd)

---

### 8.4 Agent架构

本节分析 Claude Code 的 **Agent 架构设计**：它采**用了什么架构**、**为什么选择这个架构**、**具体是怎么运行的**、**Agent 之间如何通信.** 分析了以后其实发现Claude Code很简单，看这个图，简单地说：用户输入 -组装提示词，然后就是由主Agent一直循环，判断是否调用工具，工具又分两种类型：一种是普通工具，另一种是子Agent/Agent Team.

同时，本节会结合之前笔记的理论部分，[Agent架构](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcntazl8dNTZaJzc4aPb5OBT0)，[Agent通信](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnL6L1FyA9hq4dRU1JbRdiJc)，面试真题来讲解。你会发现如果你笔记前面的很多内容你学了，学到这个架构上，他们是彼此呼应的。所以推荐从理论到实践，先把我们笔记中的Agent八股，基础知识推荐的资料看好了，再看这些成熟架构的解析，会容易一些。我们下面谈到的中Agent架构的专有名词，通信方式，其实就是在上面的理论部分出现的。建议先去学理论部分，学完再看这里，也刚好知道了理论在实践中是如何被用的。

ClaudeCode 的Agent架构有两种形态：**SubAgent**和**AgentTeam**. SubAgent对应我们[Agent架构](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcntazl8dNTZaJzc4aPb5OBT0) 部分的**中心化**，**AgentTeam** 对应这里的**去中心化**。他们的通信方式也是不同的。结合这里，我们刚好更深入理解，这两种架构的特点，如何实现，以及不同的通信方式。

![图片展示了Sub-Agents与Agent Teams两种架构模式。左侧为Sub-Agents，以一个标签页呈现，包含Main Agent和三个Worker，Main Agent与Worker间有“results”箭头，Worker仅向Main Agent报告结果，强调“Report to boss only”。右侧是Agent Teams，有多个标签页，包含Main Agent、Frontend、Backend和Verifier，各组件间有“Share tasks, discuss, coordinate”箭头，体现“discuss + coordinate”。该图与上下文介绍的Agent架构相关，对比说明了两种架构在协作方式上的差异。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/VY3qbA8P3oGlOgxEYaTcYm3ln3h.png)

注意，这里的架构，我们叫Agent架构，区别于4.4.2 的整体架构。你应该清楚的一点是，这里处于笔记4.4.2[整体架构](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnUg6OsDEn8D7uANWPpJHDkc)的哪一个环（处于整体架构React范式里，调用工具这一块的具体细节）。我们把这里叫做Agent架构，因为这里是整个系统涉及的**Agent部分的核心。**

本节是从源代码，Agent面试岗位层面来理解SubAgent和AgentTeam，要从使用层面理解，可以看[这里](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnsl080YfvlOgwhncoBfWdEe)

---

#### 8.4.1 运行机制

**宏观全景**

ClaudeCode 整个系统只有**一个 Query Loop 加一组工具**——没有任务编排器、没有状态机、没有硬编码的多步流程。把所有的 Agent / SubAgent / AgentTeam 全都剥开，里面跑的都是同一个东西：

```Plain Text
用户输入
  ↓
组装 System Prompt（CLAUDE.md + 记忆 + 工具定义 + 权限规则）
  ↓
┌──→ 调用 LLM API
│      ↓
│    模型返回：
│      ├─ 纯文本 → 输出给用户，循环结束
│      │
│      └─ 工具调用（模型自主选择）
│           │
│           ├─ Bash / Read / Write / Grep / Glob ...   ← 普通工具：直接执行
│           │    │
│           │    └→ 返回结果追加到上下文
│           │
│           └─ Agent 工具（也只是普通工具之一）         ← 特殊之处：结果来自另一个循环
│                │
│                ├→ 派生子代理（SubAgent / Teammate）
│                │     │
│                │     └→ 子代理启动自己的 Query Loop  ←── 递归：内核完全相同
│                │          ├─ 调用 LLM API
│                │          ├─ 调用普通工具
│                │          └─ 输出最终文本 / 持续通信
│                │
│                └→ 子代理的输出作为这次工具调用的返回值
│
└──── 带着工具结果继续问模型（无论结果来自普通工具还是子代理）
```

**核心洞察：子代理不是独立系统，只是某个工具的内部实现**

这套架构最精妙的地方在于：**子代理不是一个独立的子系统，它只是 "Agent 工具" 的内部实现**。主 Agent 的 Query Loop 调用 Agent 工具的方式，和它调用 Bash、Read 工具的方式**完全一样**：发一个输入、等一个返回值。

唯一的区别是——

- **Bash 工具**内部跑的是一条 shell 命令；
- **Agent 工具**内部跑的是另一个完整的 Query Loop。

对主 Agent 来说，这只是一次工具调用——它不关心子代理内部执行了多少步、调了什么工具、推理了多久，它只看到最终返回的那段文本。这也正是为什么 SubAgent 和 AgentTeam 在主 Agent 眼里没有本质区别：**它们都是同一个 Agent 工具不同参数下的产物**，只是参数不同导致内部跑出来的东西寿命、通信能力不同而已。

**模型自主决策，没有编排**

模型自己决定调用什么工具、调用几次、什么时候停止。代码里**没有硬编码的步骤编排**——不存在"第一步搜索、第二步修改、第三步测试"这种预设流程。Boris 的原话是：

> "模型就是想用工具。你给它一个工具，它就会搞清楚怎么用它来达成目标。"

打开 `src/query.ts`，核心是 `queryLoop()` 函数（约第 241 行附近），它的控制流极其简单：

```Plain Text
while (true) {
    1. 把当前消息发给模型 → 拿到模型的回复
    2. 检查回复里有没有 tool_use block
       - 有 → 执行这些工具 → 把工具结果拼回消息 → continue（回到第 1 步）
       - 没有 → break，循环结束
}
```

就这么多。注意这里**没有任何 if-else 判断"应该调什么工具"**——没有"如果用户问代码就调 Read"、"如果要搜索就调 Grep"这种路由逻辑。这些在传统 Agent 框架里需要开发者手写的策略代码，在 ClaudeCode 里根本不存在。Query Loop 的角色仅仅是一个**执行器**：模型说调工具就调，模型说停就停，它本身不参与任何决策。

子代理的调用也是同理——Query Loop 不会判断"这个任务该不该派子代理"。模型在回复中输出一个 Agent 工具的 `tool_use` block，Query Loop 就像执行任何其他工具一样执行它。对 loop 来说，**派子代理和读文件没有区别**，都只是一次工具调用。而子代理内部又启动了自己的 Query Loop——同样的 `while(true)`、同样由模型自主决定调什么、什么时候停。这就是 **Agent 调 Agent 的递归本质**：每一层都是同一个循环结构，只是上下文与可用工具集不同。

**既然没有编排，决策力全靠提示词**

这套"零编排"架构的代价 / 也是它的设计哲学是：**所有的决策力都必须从提示词里来**。模型怎么知道什么时候该派 SubAgent、什么时候该建 AgentTeam、什么时候自己干就行？答案是：

- **工具的 `description`**：告诉模型"我是干什么的、什么时候用我"；
- **System Prompt 中的指南**：告诉模型整体的工作风格、协作规范；
- **CLAUDE.md / 项目记忆**：告诉模型项目的特定约定。

因为本质上 Agent 工具就是一个普通工具，模型决定要不要调它、传什么参数，靠的就是它的 `description` 和当下的上下文判断——和它决定要不要调 Bash 是同一套机制。**所以 SubAgent / AgentTeam 谁来、什么时候来，不是代码控制的，是 prompt 设计出来的。** 这个观点很重要，后面 4.4.4.2 与 4.4.4.3 讲两种拓扑时，会反复看到"通过 prompt 约束行为"这条线索。

---

#### 8.4.2 SubAgent - 中心化架构

ClaudeCode 的 SubAgent 模式采用的是 **中心化架构**——准确地说，是一种 **星型拓扑**：一个主 Agent 居中，所有子代理围绕它呈辐射状分布，信息只在主 Agent 与子代理之间流动，**子代理之间没有任何直接连接**。

这里的"主 Agent"其实就是 ClaudeCode 里跟你对话的那个 Agent。它通过工具调用的方式派生出多个子代理，每个子代理拥有自己的上下文、模型与工具集，独立处理被分派到的任务。任务完成后，子代理把结果回传给主 Agent，然后即被销毁。

这个模式的特点是：

- **主 Agent 是唯一枢纽**：所有调度、汇总、与用户的对话都由主 Agent 完成，子代理只对主 Agent 负责。
- **子代理之间不通信**：任何跨子代理的协调，都必须经过主 Agent 中转，没有横向连接。
- **一次性、无状态**：子代理"被唤醒 → 干活 → 回传 summary → 销毁"，不跨轮次驻留，主 Agent 拿到的只是精炼后的结果，不会被中间过程污染。
- **上下文隔离**：每个子代理拥有独立上下文窗口，可以放心去读大量文件、跑大量搜索而不污染主对话。
- **安全与审计简单**：单一信息枢纽意味着单一审计点，权限边界、工具限制都好控制。
- **代价**：拓扑越简单，越难表达"**长期协作**""**互相质疑**""**并行讨论**"这类需要成员对话的场景——所有协作都要在主 Agent 这里"绕一圈"。

```Plain Text
                    ┌─────────┐
                    │  用户    │
                    └────┬────┘
                         ↕
                  ┌──────┴──────┐
                  │  主 Agent   │ ← 你的ClaudeCode主对话Agent
                  │ (Query Loop)│
                  └──┬───┬───┬──┘
                    ↗    ↑    ↖
                  ↙      ↓      ↘
            ┌────┴──┐ ┌──┴───┐ ┌──┴────┐
            │子代理A │ │子代理B│ │子代理C │
            └───────┘ └──────┘ └───────┘
                  ✗ 互不通信 ✗
```

> 铛铛铛，如果你想进阶学习Subagent的东西，可以看这个电子书的[这一章](https://lintsinghua.github.io/#ch09)。给大家画一下重点，如果你想了解：
> 
> 1. SubAgent是如何实现的，数据结构是啥，怎么产生的(使用Fork方式）。
> 
> 2. Fork的具体好处（Prompt Cache减少开销）
> 
> 3. SubAgent如何运行，何时中止，它内部的AgentLoop是什么？
> 
> 4. SubAgent的权限系统，可以用哪些工具。 可以看这个链接。
> 
> 我没有总结得无限深入。当我总结面试，遇到相关要深入的点，我会再展开扩展，如果你想了解上述内容，可以自己去看哦。

#### 8.4.3 AgentTeam — 去中心化网状拓扑

与 SubAgent 的星型模式不同，AgentTeam 采用的是 **去中心化架构**——更准确地说，是一种 **网状拓扑**：团队中的每个 Agent 都是对等成员（peer），既可以独立工作，也可以**直接**与任意其他成员交换信息，不必经过一个"中央调度者"中转。

这里没有"主 Agent"这个唯一的信息枢纽。原本的对话 Agent 在 AgentTeam 模式下退化为 **Team Lead**——它仍然负责接收用户输入、做总体规划，但**不再垄断通信路径**：成员之间可以绕过它彼此对话、彼此分派、彼此挑战。

这个模式的特点是：

- **成员对等**：每个 Agent 是长期驻留的独立实体，拥有自己的上下文、模型与工具集，生命周期跨越多个轮次，不像 SubAgent 那样"一次性唤醒、用完即销毁"。
- **横向通信存在**：成员之间可以**点对点直发**（A → B）、也可以**广播**（A → 全员），无需 Team Lead 转手。具体通信机制（邮箱 / 消息工具 / 共享任务表等）在后续小节专门展开，此处不细说。
- **共享态势**：团队通常持有一份共享的任务列表（TaskList），让每个成员实时掌握整体进度与彼此的待办，避免重复劳动与盲区。
- **协作模式更丰富**：因为成员能互相对话，可以自然演化出"竞争假设""并行审查""模块归属""方案审批 / 魔鬼代言人"等多种协作范式，而不只是 SubAgent 那种"主 Agent 派活 → 子 Agent 干活 → 回传 summary"的单向流水。
- **代价**：拓扑越自由，协调成本与审计复杂度越高——需要显式的消息协议、锁与可见性约束来防止信息错位；这也是后续通信章节要重点讨论的内容。

```Plain Text
                    ┌─────────┐
                    │  用户    │
                    └────┬────┘
                         ↕
                  ┌──────┴──────┐
                  │ Team Lead   │  ← 你的ClaudeCode主对话Agent
                  │ (规划/汇总)  │    
                  └──┬───┬───┬──┘
                     │   │   │       
                 ┌───┘   │   └───┐
                 ↓       ↓       ↓
            ┌────┴──┐ ┌──┴───┐ ┌─┴─────┐
            │AgentA │⇄│AgentB│⇄│AgentC │
            └───────┘ └──────┘ └───────┘
                  ✓ 成员之间直接通信 ✓
                  ✓ 长期驻留、多轮协作 ✓
```

> 适用场景：**长期协作型**工作——例如多个模块负责人需要持续对接接口变更、不同视角的审查者要互相挑战方案、多个假设需要并行验证并相互辩论。

**AgentTeam VS SubAgent**

- **拓扑**：SubAgent 是中心化的 Star，AgentTeam 是去中心化的 Mesh。
- **主控节点**：SubAgent 模式下主 Agent 是唯一枢纽；AgentTeam 模式下 Team Lead 只做规划，不再垄断通信。
- **成员通信**：SubAgent 中子代理之间不通信，一切经主 Agent 中转；AgentTeam 中成员可点对点直发，也可广播。
- **生命周期**：SubAgent 一次性、用完即销毁；AgentTeam 长期驻留、跨轮协作。
- **共享状态**：SubAgent 无共享态势；AgentTeam 通常带共享任务列表等团队级状态。
- **适用场景**：SubAgent 适合任务分发与信息隔离；AgentTeam 适合长期协作与互相质疑。

#### 8.4.4 通信方法

这一节专门讲通信机制——SubAgent 与 AgentTeam 采用的是两条完全不同的代码路径。

##### 8.4.4.1 SubAgent 的通信方法

SubAgent 模式下，**子代理之间不通信**，所有信息流都是"主 Agent ↔ 子代理"的单跳。具体走的是 ClaudeCode 的工具调用通道，本质上和 Read、Bash 这些工具是同一套机制——只不过这个"工具"返回的不是文件内容，而是一个子 Agent 跑完一整段对话循环后的产物。

整个过程可以拆成三步：

1. **下行 / 派发**：主 Agent 调用 `Task` 工具，把任务描述（prompt）、可用工具集、可选模型作为参数传进去。这次调用在主 Agent 的对话历史里就是一条普通的 `tool_use`。
2. **隔离执行**：被派出的子代理拿着这段 prompt，在**一个全新的、与主对话隔离的上下文窗口**里跑自己的 Query Loop——读文件、调工具、推理，全部发生在它自己的上下文里，不会回流到主 Agent。
3. **上行 / 回传**：子代理完成后，把最终的结论压缩成一段 **summary 文本**，作为这次 `Task` 工具调用的 `tool_result` 返回给主 Agent。主 Agent 只看到这段 summary，看不到中间过程。

这种通信方式有几个直接后果：

- **单跳、无状态**：每次调用都是一来一回，子代理拿不到上一次自己的历史，也拿不到兄弟子代理的历史。
- **天然降噪**：中间几十轮 reasoning 不会污染主 Agent 的上下文，主 Agent 拿到的永远是被压缩过的结论。
- **协调必须经主 Agent 中转**：如果"子代理 A 的结果要影响子代理 B 的任务"，只能由主 Agent 在拿到 A 的 summary 之后，再发起一次新的 `Task` 去派 B——子代理之间没有任何直接通路。
- **审计点单一**：所有跨 Agent 的信息流都凝结在主 Agent 对话历史里的那几条 `tool_use` / `tool_result` 上，事后追溯非常清晰。

一句话：SubAgent 的"通信"其实就是**一次带隔离上下文的函数调用**，参数是 prompt，返回值是 summary。

##### 8.4.4.2 AgentTeam 的通信方法

AgentTeam 模式下，成员是长期驻留的对等节点，需要在多轮之间持续交换信息，因此走的不再是"工具调用 → 返回值"这种一次性通道，而是一套**异步消息传递**机制。

可以从两个维度去理解它：

**(1) 传输层：消息靠"邮箱文件"投递**

每个 teammate 都有一个属于自己的**收件箱**，相当于一个先进先出的消息队列。在 ClaudeCode 的实现里，这个 inbox 就是一个**本地 JSON 文件**，路径形如：

```Plain Text
~/.claude/teams/{team_name}/inboxes/{agent_name}.json
```

发件方往对方的 inbox 文件里追加一条消息记录，收件方在自己下一轮被唤醒时从 inbox 文件里读出未读消息，并把这些消息**注入到本轮的 prompt 上下文**里参与推理。文件级别的并发写入通过 `lockfile` 加锁串行化，避免多个 teammate 同时写同一个收件箱时彼此覆盖。

也就是说："通信"在 AgentTeam 里被建模成了"**在文件系统里给对方收件箱追加一段内容**"——不是函数调用，不是 RPC，而是一次异步的、落盘的消息投递。这套机制天然支持跨进程、跨 session：只要大家约定好 `~/.claude/teams/...` 这个目录，不同的 ClaudeCode 进程就能互相收发消息。（源码里还有一个 `UDS_INBOX` 开关，用 Unix Domain Socket 在本机做更低延迟的跨 session 投递，但默认形态就是本地文件邮箱。）

**(2) 应用层：通过专用消息工具发送**

teammate 不能"直接说话"——光在自己的回复里写字，别人是看不到的（这条约束甚至会被写进它们的 system prompt 里强制声明）。要让信息真正流出去，必须显式调用一个**消息发送工具**，常见两种用法：

- **点对点（unicast）**：指定收件人，例如 `{"to": "<某成员>", "message": "..."}`，消息只投到那个成员的 inbox。
- **广播（broadcast）**：指定"全员"为收件人，例如 `{"to": "*", "message": "..."}`，消息被投递到团队中所有其他成员的 inbox。

除了点对点消息之外，AgentTeam 还会维护一份**共享的 TaskList**，作为另一条"被动通信"的通道：成员把自己的任务进展更新到 TaskList，其他成员在自己的下一轮上下文里就能看到整团的最新进度。这样很多"我在干什么、你接下来该做什么"的信息根本不需要点对点消息，靠看共享任务表就够了。

和笔记的理论部分：[Agent之间的通信和状态管理对应](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnL6L1FyA9hq4dRU1JbRdiJc)：

SubAgent使用的通信模式是：工具调用。 Agentteam使用的通信模式是：消息协作。

SubAgent使用的消息传递媒介是：内存通道。 Agentteam使用的消息传递媒介是：文件通道。

#### 8.4.5 架构选型背后的思考

在笔记 [Multi-Agent架构](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcntazl8dNTZaJzc4aPb5OBT0) 章节，我们聊到了中心化和去中心化的优缺点。

在笔记 Harness中的[ Orchestation](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnBDNWryuCSfyVJx6g96CnVh) 章节，参考视频有谈到去中心化架构尽量不要用，因为他会引入非常复杂的协调税。一般推荐中心化。

结合我们解析的Openclaw, Hermes 他们使用的架构也是以中心化架构为主。包括ClaudeCode 虽然使用了AgentTeam，但是他默认不是对所有人开放的，如果要使用它，需要修改配置参数。以及我查阅了专门讲ClaudeCode的[书籍](https://lintsinghua.github.io/)，他甚至没有讲AgentTeam, 只讲了SubAgent。 所以可以看出，去中心化是一种高级的技巧。推荐不要一开始就使用它，它很难驾驭，先从单Agent, 中心化架构，这样的架构入手，有必要才使用去中心化架构。

（这个思考，在你看完了这些上面的书籍，资料后，你可能也会有自己的思考，这些都是可以体现在和面试官交流上）

#### 8.4.6 面试内容

**面试呼应**

> 这几个问题是我之前面试被问到过的，我以这个举例子，告诉大家我们学的东西其实都是面试考的。而且你学完了，都是直接对你面试有帮助的。没学习这个小节之前，面试官问你Agent如何通信，当然你可以回答理论部分。学了以后，加入了CC和Openclaw，一定回答就更好了。所以很多问题的答案，是在我们学习的过程，不断总结提炼出更好的答案的。

**（面试原题）：如果 Agent 之间通信，某些东西不想给另一个 Agent 看到，应该怎么做？**

采用**仅共享最终结果**的消息传递策略。每个子 Agent 拥有独立的上下文空间，所有中间推理过程——包括中间的工具调用链、思维链——都留在子 Agent 的私有空间里，执行完成后只把最终结论提取出来返回给父 Agent，父 Agent 看不到任何中间步骤。这样做的好处有两个：一是隐私隔离，某个子 Agent 的中间数据不会泄露给其他 Agent；二是控制上下文膨胀，如果把所有中间步骤都传回去，父 Agent 的上下文窗口会快速爆满。这个策略在实际项目中是主流做法，比如 Claude Code 的子代理只返回纯文本结果，OpenClaw 的子 Agent 也是只把蒸馏后的最终回复推送给父 Agent

Agent 间通信模式的选择，面试中通常这样问：

**你的 Agent 之间是如何通信的？（或者：你项目里的多 Agent 是怎么协作的？）**

> 这里是以ClaudeCode的Subagent模式来回答的，当然你可以从AgentTeam角度，也可以回答。

面试时可以从三个层面回答：

第一，**架构选型**：我们采用中心化架构，一个主 Agent 作为编排者，通过工具调用的方式委派任务给子 Agent。选择中心化而非去中心化的原因是，对话场景天然是"一进一出"的结构——用户发一条消息，最终要有一条连贯的回复，必须有且只有一个 Agent 对最终输出负责。中心化的星型拓扑正好对应这个模型：主 Agent 是唯一的回复责任人。

第二，**通信模式**：使用工具调用而非移交。主 Agent 保留控制权，把子任务作为参数发给子 Agent，等结果回来后自己整合决策。子 Agent 之间不直接通信，如果 A 的结果需要被 B 使用，必须由主 Agent 中转——先拿到 A 的结果，再把相关信息写进给 B 的任务描述中。

第三，**消息内容**：仅传递最终结果，不传递中间推理链。子 Agent 在自己的独立上下文中完成全部推理和工具调用，只把最终结论返回给主 Agent。这样既保护了各 Agent 的中间数据隐私，也有效控制了主 Agent 的上下文膨胀。

#### 8.4.7 视频讲解

面试必考：细致拆解ClaudeCode架构

https://www.bilibili.com/video/BV11Fd8BcEFh/?vd_source=144bec9c3f54e465073138bed788be1b

### 8.5 权限系统与安全审查

> 学习ClaudeCode的权限处理，除了应对面试官问你CC 权限系统是如何设计的这个问题（有朋友被问过）。另外你也可以应对面试官问你Agent安全相关的问题，比如如何避免Agent乱调用工具对系统产生破坏。除此之外也希望大家学会了本节，在设计自己Agent项目的时候可以在Agent的权限系统/安全上进行设计，会让自己的项目更加有深度，不被质疑是玩具项目。最后学了本节，其实你在使用ClaudeCode不同模式的时候，其实也可以知道里面的运行原理。

本节分析 Claude Code 的权限与安全机制。无论是主 Agent 还是子代理，每次调用工具（写文件、执行命令等）都要经过同一套权限管道的审查。Boris 用"瑞士奶酪模型"形容这套设计——叠加多层防御，每层都可能有漏洞，但叠在一起漏洞被覆盖。

#### 8.5.1 总览：四层权限管道

当主 AI 请求执行任何操作时，都要依次经过四层安全过滤。每一层都可以直接做出"放行"或"拒绝"的终审判决，只有当本层说"我没意见"时，请求才会继续流入下一层。

```Plain Text
                      主 AI 请求执行一个操作
                               │
                               │
         ═══════════════ 第一层：规则过滤 ═══════════════
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
    命中 deny 规则        命中 allow 规则         无规则命中
         │                     │                     │
         ▼                     ▼                     ▼
     ❌ 直接拒绝           ✅ 直接放行          继续 ↓
    （不可覆盖）
                                                     │
         ═══════════════ 第二层：工具自检 ═══════════════
                                                     │
                                      ┌──────────────┼──────────────┐
                                      ▼              ▼              ▼
                                   工具拒绝       工具放行      工具无意见
                                  (.git等          (项目内
                                   路径免疫)        读取等)
                                      │              │              │
                                      ▼              ▼              ▼
                                  ❌ 拒绝        ✅ 放行       继续 ↓
                                                                    │
         ═══════════════ 第三层：模式兜底 ═══════════════
                                                                    │
                    ┌───────────────┬───────────────┬───────────────┐
                    ▼               ▼               ▼               ▼
               bypass 模式    default 模式    dontAsk 模式     auto 模式
                                (以及 acceptEdits、
                                 plan 等，行为相同)
                    │               │               │               │
                    ▼               ▼               ▼               ▼
                ✅ 放行       ⏸️ 弹框问用户    ❌ 直接拒绝    进入第四层 ↓
                                                                    │
         ════════════ 第四层：AI 分类器（动态审查）═════════════
                                                                    │
                                         ┌──────────────────────────┼──────────┐
                                         ▼                          ▼          ▼
                                    安全工具白名单             工作目录内编辑   都不适用
                                   (Read/Grep/…)                               │
                                         │                          │           ▼
                                         ▼                          ▼    AI 分类器
                                     ✅ 放行                   ✅ 放行    （独立 AI）
                                                                          │
                                                                   ┌──────┴──────┐
                                                                   ▼             ▼
                                                               允许：✅       阻止：⏸️
                                                               放行        降级为用户确认
```

**每一层解决什么问题？**

**第一层（规则过滤）**：解决"用户已经明确知道哪些操作安全、哪些危险"的场景。比如你知道 `python` 命令在你的项目里是安全的，就配一条 allow 规则永久放行，不用每次都确认。这是**用户意志的直接表达**——提前告知系统"这个我信任"或"这个绝不允许"，与当前处于什么模式完全无关。

**第二层（工具自检）**：解决"规则覆盖不到的、需要理解操作内容才能判断的场景"。规则是按"工具名+命令模式"做粗粒度匹配的（比如 `Bash(rm:*)`），但它无法理解操作的语义。比如 Write 工具被允许了，但写入目标是 `.git/config`——这种"路径是否越界"的判断只有工具自己的代码才能做。Bash 工具更复杂，它会用 shell AST 解析器分析命令结构，检测命令替换、进程替换、注入攻击等。这一层的本质是：**每个工具根据自己对操作内容的专业理解，用确定性的代码逻辑做细粒度安全判断**。

**第三层（模式兜底）**：解决"规则没覆盖到、工具也没意见时怎么办"的问题。到了这一层，说明前面的确定性检查都没有做出判决，需要一个"兜底策略"。不同模式代表不同的风险偏好：bypass 信任一切，default 什么都问人，dontAsk 什么都拒绝，auto 交给 AI 判断。这一层的本质是：**把最终决定权交给用户选择的风险偏好**。

**第四层（AI 分类器）**：只有 auto 模式才会走到这里。它解决的是"不想每次都手动确认，但又不想像 bypass 那样完全放弃安全检查"的矛盾。方案是引入一个**独立的 AI 分类器**来代替人做判断——它读取对话上下文，理解当前操作的意图，判断是否安全。为了省钱，分类器前面有两条快速路径：安全工具白名单（Read/Grep 等零副作用工具直接跳过）和工作目录内编辑（项目内改代码不需要审查）。只有这两条都不适用时，才真正调用 AI 分类器。

**为什么是四层而不是一层？**

这四层的设计遵循"瑞士奶酪模型"——每层都可能有漏洞，但叠在一起漏洞被覆盖。同时，四层的排列顺序也体现了**从确定性到不确定性的递进**：

```Plain Text
确定性高 ──────────────────────────────────────→ 确定性低

 第一层          第二层          第三层           第四层
 规则过滤        工具自检        模式兜底         AI 分类器
 ─────          ─────          ─────           ─────
 纯配置匹配      代码逻辑判断    策略分流         AI 推理判断
 ← 零成本 →     ← 零成本 →     ← 零成本 →      ← 额外API调用 →
```

越靠前的层越"刚性"（确定性高、成本低、不可覆盖），越靠后的层越"柔性"（需要推理、有成本、可降级）。这样设计的好处是：大部分操作在前三层就被处理了（要么放行要么拒绝），只有少数"不确定"的操作才需要走到最后的 AI 分类器——既保证了安全，又控制了成本。

下面逐层展开。

#### 8.5.2 第一层：规则过滤

> 这一层我在使用github copilot的时候也有，大家有没有注意到在使用copilot的时候，如果有一个工具，他让你点击approve，下面有选项（是否alway approve)，如果你点了是，其实就在对应copilot的配置文件（json)中把这个命令设置为allow,下次执行相同内容就不会再要approve了。 
> 
> 这个方法是CodingAgent的通用技巧，设置规则，下次直接按照规则命中。

这一层与当前处于什么模式**完全无关**，是一道纯粹的静态匹配。

**什么是规则？**

规则是用户在 `settings.json` 中配置的、针对具体工具的白/黑名单。每条规则指定一个行为（allow / deny / ask）和一个匹配模式：

```JSON
{"permissions": {"allow": ["Bash(mkdir:*)",     // 允许所有 mkdir 命令"Bash(python:*)",    // 允许所有 python 命令"Bash(ls:*)"         // 允许所有 ls 命令],"deny": ["Bash(rm -rf:*)"     // 禁止所有 rm -rf 命令]}}
```

格式是 `工具名(内容匹配)`，例如 `Bash(npm test)` 只匹配 `npm test` 命令，`Write` 匹配所有文件写入，`mcp__server1` 匹配指定 MCP 服务的全部工具。

> 这些细节也不用强行记住，就是给大家看一下，重要的是这个思路，具体细节面试问的少。

**规则有 6 个配置层级**，优先级从高到低：

![图片展示了权限系统规则的6个配置层级及其说明和典型场景。层级从上至下依次为policySettings（管理员/企业策略）、userSettings（用户全局设置）、projectSettings（项目级设置）、localSettings（本地设置）、cliArg（命令行参数）、session（会话级）。如policySettings用于公司统一策略，典型场景是禁止rm -rf；userSettings用于个人习惯，如允许python:*；projectSettings用于项目约定，如允许npm test等。该图与上文介绍的权限系统规则配置层级及执行逻辑内容相关，直观呈现了各层级的配置情况。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/NOqJbzxsxo7Y43xreqVcE71ZnWg.png)

**执行逻辑**：deny 规则命中 → 直接拒绝（终审），allow 规则命中 → 直接放行（终审），ask 规则命中或无规则命中 → 流入下一层。

关键设计：**deny 规则是不可覆盖的**。即使在 bypass 模式下，deny 规则仍然生效。这确保了管理员策略能够硬性约束用户行为。

#### 8.5.3 第二层：工具自检

每个工具内部都可以实现一个 `checkPermissions()` 方法，根据**本次操作的具体内容**做安全判断。这不是配置驱动的，而是工具代码中写死的安全逻辑。

典型例子：

- **Bash 工具**：检查命令本身是否属于高风险操作
- **Write/Edit 工具**：检查目标文件路径是否合法
- **安全路径检查**：`.git/`、`.claude/` 等关键目录有特殊保护——即使在 bypass 模式下也不能跳过，源码注释称之为 **"bypass-immune"**（免疫 bypass）

工具自检有三种返回值：

- **拒绝**：终审，直接拒绝操作
- **放行**：终审，直接通过
- **无意见**：不做判断，流入下一层

这一层的意义在于：规则是按"工具名 + 命令模式"做粗粒度匹配的，无法理解操作的语义。比如规则允许了 `Write`，但工具自检可以进一步检查"写入的目标是不是 `.git/config`"——这种细粒度判断只有工具自己能做。

#### 8.5.4 第三层：模式兜底

> 设置模式。这个大家在使用CC的时候想必有印象。在CLI下方有:acceptEdits on等提示。学习了本节你更会理解在不同的模式下的预期行为。
> 
> 大家可能困惑为啥自己使用CC 切换不到某种模式。要注意的是，里面有一些模式，比如bypassPermissions 是要通过命令行参数启动的，dontAsk并不可用（只是源码里有）。auto 是需要使用feature flag才能开启的。

走到这一层，说明前两层都没有做出判决——没有命中规则，工具也没有意见。此时由当前的**权限模式**决定兜底行为。

Claude Code 有 5 种用户可设置的模式和 2 种内部模式：

![图片是一张表格，展示了Claude Code中7种用户可设置的模式和2种内部模式的类型、行为及说明。其中，用户可设置的模式有default（弹框问用户）、acceptEdits（项目内编辑放行）、plan（写操作拒绝）、bypassPermissions（直接放行）、dontAsk（直接拒绝）；内部模式为auto（进入分类器管道）、bubble（权限冒泡）。表格还对各模式的特殊之处进行了说明，如acceptEdits和plan的核心逻辑不在第三层，而是在第二层工具自检时生效。该表与上文介绍Claude Code模式的内容紧密相关，是对模式分类及行为的详细说明。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/ZbeFbHS4ooAJypxvIpocxJDrn6Z.png)

注意 `acceptEdits` 和 `plan` 的特殊之处：它们的核心逻辑**不在第三层，而是在第二层工具自检时就生效了**。`acceptEdits` 下的 Write 工具检测到项目内编辑直接放行，`plan` 下的 Write 工具直接拒绝写操作——走到第三层时，剩下的操作和 `default` 行为相同（弹框问用户）。

重点说明两个容易误解的模式：

**bypass 不是无敌模式**。它排在第三层，意味着第一层的 deny 规则和第二层的安全路径检查（bypass-immune）已经先执行过了。bypass 只是"如果前面的层都没有拦你，那我也不拦你"——它跳过的是本层的确认弹框，而非整个安全管道。

**dontAsk 不是"全部允许"，而是"全部拒绝"**。它的语义是"不要问我，直接拒绝所有没有被规则明确放行的操作"。适合无人值守场景：只跑规则白名单内的操作，其余一律拦截。

#### 8.5.5 第四层：AI 分类器（动态审查）

> 这一层就是有一个分类器，也就是使用AI最后来判断，是否允许还是拒绝还是人工approve。只不过这一层也有策略，先固定规则跑 - AI弱分类（省Token) - AI强分类 - 错误处理兜底。 所以这就是企业项目和自己做的项目的区别。大家自己做，用AI分类，可能就调用个API写个提示词就完了，但是企业项目是用了多层的调用。 看了这些架构我们也应该有意识对齐，当然自己做项目肯定不如企业项目复杂，但是我们可以尽量设计得更复杂，更稳健，让面试官觉得我们的项目并不简单。

只有 **auto 模式**才会走到这一层。这就是视频文稿中提到的"背后跑了两个 AI"——主 AI 负责干活，另一个独立的 AI 做安全分类，审查每个操作是否安全。

**快速路径（省钱优化）**

在真正调用 AI 分类器之前，先检查两条快速路径：

1. **安全工具白名单**：`Read`、`Grep`、`Glob`、`Sleep`、`TodoWrite` 等完全无副作用的工具，直接放行，无需分类器审查。设计原则是——只有**零副作用**的工具才进白名单，`Write`、`Edit`、`Bash` 这些有副作用的工具一律不在。
2. **工作目录内的编辑**：如果操作是在项目目录内编辑文件（模拟 acceptEdits 行为），也直接放行。

大部分日常操作（读文件、搜索、在项目内写代码）在快速路径就被放行了，只有少数操作需要真正调用分类器。

**两阶段分类器（先粗筛后精筛）**

快速路径都不适用时，调用 AI 分类器。它不是简单地问一次"安全吗？"，而是**同一个问题问两遍，用不同的力度**：

```Plain Text
     Stage 1：快速粗筛（64 token，偏保守）
     提示词要求 "Err on the side of blocking"（宁可错拦，不可漏放）
         │
         ├─ 判断为安全 → ✅ 直接放行（完成）
         │                  大部分安全操作在这里就结束了
         │
         ├─ 判断为危险 → 进入 Stage 2
         └─ 无法判断   → 进入 Stage 2
                              │
                              ▼
     Stage 2：深度精筛（4096 token，带推理链）
     要求 AI 先写下推理过程，再给结论
         │
         ├─ 判断为安全 → ✅ 放行（翻案成功）
         ├─ 判断为危险 → ❌ 阻止
         └─ 无法判断   → ❌ 阻止（安全优先）
```

设计理念：Stage 1 偏向保守（提示词原文 "Err on the side of blocking"，即宁可错拦），只用 64 token 做一个快速的安全/危险判断——如果连保守策略都认为安全，那确实安全，不需要进一步审查。Stage 2 给被误拦的操作一次"翻案"机会，用 4096 token 让 AI 写下完整的推理链再做结论，减少误报。如果 Stage 2 也无法给出明确结论，

**默认阻止（fail closed）**。

为什么不直接用一个阶段？**省钱**。大部分操作在 Stage 1 就完成了（64 token，快且便宜），只有被 Stage 1 标记为"可疑"的操作才需要 Stage 2 的深度推理（4096 token，慢且贵）。

**防注入设计**

分类器的输入经过精心过滤。最关键的一点：**对话记录中故意排除了主 AI 的文本输出，只保留用户消息和工具调用记录**。

原因是：恶意代码文件可能包含 prompt injection 指令，让主 AI 输出特定文本来"说服"分类器放行危险操作。通过排除主 AI 的文本，分类器只看到"做了什么"（工具调用），看不到主 AI "说了什么"——从源头阻断注入攻击路径。

分类器还有自己独立的系统提示词，读取 CLAUDE.md 作为用户意图上下文，与主 AI 的提示词体系完全隔离。

**容错与降级**

分类器不是 100% 可靠的系统，源码设计了三种降级机制：

![图片展示了分类器在异常场景下的处理方式及设计原则。当分类器API不可用时，采用Iron Gate机制，退回用户手动确认，设计原则为Fail Closed，宁可中断也不放过；连续多次拒绝时，自动降级为用户确认模式，防止分类器误判阻塞工作流；对话记录超出上下文时，交互模式退回手动确认，无人值守模式直接终止，确定性错误不重试。此图与上文介绍的分类器降级机制内容紧密相关，是对分类器在不同异常场景下处理方式的总结。](03_ClaudeCode源码解读_images/B-开源框架解读：Cla/CYbEbzuA5oBWNAx14jCcr5ySnBf.png)

这里是一个面试问题考点，请看 [腾讯AI Agent暑期实习，面试问题2：如果用户和AI对话生成问题本身有冲突，系统应该怎么处理](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcnQlnC1HE33DYfyVskW4y44c)

#### 8.5.6 设计思想

回顾整个四层管道，有三个核心设计思想值得展开：

**第一，纵深防御（Defense in Depth）**

不依赖单一安全机制，而是叠加四层——静态规则做快速过滤，工具自检做细粒度判断，模式做策略兜底，AI 分类器做上下文感知的最终审查。每层都可能有漏洞，但叠在一起漏洞被覆盖。这就是 Boris 所说的"瑞士奶酪模型"。

**第二，Fail Closed（默认拒绝）**

贯穿整个管道的基调是"不确定就拒绝"：分类器解析失败 → 阻止，分类器 API 不可用 → 退回用户确认，dontAsk 模式下无规则覆盖 → 拒绝。系统不会因为任何故障而放过潜在危险操作。

**第三，安全与效率的平衡**

用 AI 做安全审查更准但更贵（每次操作都要额外 API 调用）。源码通过三级优化降低开销：安全工具白名单（零副作用工具直接跳过）、acceptEdits 快速路径（项目内编辑直接通过）、两阶段分类器（Stage 1 用 64 token 快速过滤大部分安全操作）。最终，真正需要完整分类器推理的操作是少数。

**面试呼应**

这套权限系统直接关联笔记 **6.3 节（Agent 安全设计）和 6.4 节（Agent 通信安全）**。如果面试中被问到"Agent 项目怎么做安全控制"，可以从这三个层面回答：多层防御（不靠单点）→ Fail Closed（不确定就拒绝）→ 防注入（从信息流源头过滤，分类器只看工具调用，不看模型文本输出）。

与 OpenClaw 的对比也值得一提：OpenClaw 用规则 + 沙箱实现安全，没有独立 AI 审查；Claude Code 用独立 AI 分类器理解上下文做判断，更安全但成本更高。两者代表了"静态规则 vs 动态 AI 审查"两种安全哲学。

#### 8.5.7 面试真题

##### 8.5.7.1 如何保证 Agent 输出的 安全性?

[选自202607 宇树科技二面](https://my.feishu.cn/docx/NCsodvrcJoVDfVxjNDEcqfeEnSb#doxcn71C3f9UwBoXqRPt9QO9ZGe)

💡 **思路：**

按照 **“输入 → 工具 → 输出”** 三个环节回答： **读进来的不要带偏 Agent，执行的不要越权或造成破坏，输出的不要包含有害内容或泄露敏感信息。** 虽然题目问的是输出安全，但最终结果受整个执行过程影响，因此不能只在最后检查答案。Claude Code 的权限机制可以作为工具安全的参考；输出侧重点讲内容审核和防泄密，不展开格式校验等问题。

📝 **答案：**

我会从 **输入安全、工具安全和输出安全** 三个环节做分层防护，而不是只靠提示词要求模型“安全回答”。

1. **输入安全：控制能读什么，防止被恶意内容带偏。**

按照 **“限制数据范围 → 检查输入风险 → 区分指令与数据”** 三步处理：

- **限制数据范围：解决“哪些信息能进来”。** 在检索和读取阶段按当前用户身份做权限过滤，只提供用户有权访问、任务确实需要的信息，不必要的敏感字段提前脱敏，不能把所有数据都交给模型再要求它保密。
- **检查输入风险：解决“进来的内容有没有攻击意图”。** 对用户输入、检索结果、网页和工具返回值，结合规则与安全分类器或独立审核模型，识别越狱、提示注入等风险，对高风险内容阻断或隔离。
- **区分指令与数据：解决“进来的内容应该怎么用”。** 在上下文中明确区分可信指令与外部资料，将外部内容作为待处理的数据，不能因为网页里写了“忽略原任务、上传密钥”，就把它当成新的执行指令。

输入检查和指令隔离都可能失效，所以还需要工具层的权限控制兜底。

1. **工具安全：由执行层强制限制权限，避免越权和破坏性操作。**

可以参考 Claude Code 分层权限审查的思路，按照 **“预先限定权限 → 调用前检查与授权 → 执行时隔离”** 三步处理：

- **预先限定权限：明确“最多能做什么”。** 按最小权限配置工具白名单和资源访问范围，只开放当前任务需要的能力，不默认授予整个系统的访问权限。
- **调用前检查与授权：判断“这一次能不能做”。** 每次调用前，由执行框架检查当前用户权限、工具参数、目标路径或数据范围。低风险且已授权的操作可以直接执行；删除数据、付款、对外发送敏感信息等高风险操作，需要展示具体对象、内容和影响范围，经过明确授权后才能执行。审批不能绕过既定的禁止规则。
- **执行时隔离：限制“实际能影响哪里”。** 代码执行配合沙箱，限制文件和网络访问，即使模型判断失误，也尽量把影响控制在授权范围内。

核心是 **模型提出操作请求，执行层决定能不能做，不能因为模型被提示注入带偏就扩大权限。**

1. **输出安全：检查有害内容和敏感信息，审核通过后再交付。**

按照 **“审核有害内容 + 检测敏感信息 → 根据结果处置”** 处理，前两项是检查维度，最后一项是处理措施：

- **审核有害内容：检查“回答本身是否有害”。** 在回答返回用户前，结合内容安全规则、安全分类器或独立审核模型，判断是否包含违反业务安全政策的有害内容，而不是只靠敏感词匹配。
- **检测敏感信息：检查“有没有泄露不该披露的信息”。** 检测密钥、凭据、个人隐私和内部敏感资料，并结合当前用户权限和任务需要，判断是否允许披露。
- **根据结果处置：决定“最终交付什么”。** 审核通过后才交付；发现风险时，根据情况脱敏、阻断、生成安全替代回答或转人工。修改后的内容仍需要再次审核，不能把原始风险内容直接发给用户。

最后，用越狱、提示注入、越权调用和泄密案例做上线前测试与持续回归，监控漏拦率和误拒率。 **安全不能承诺百分之百，而是通过分层防护降低风险，并限制出问题后的影响范围。**

**总结：输入侧防带偏，工具侧防越权，输出侧防有害内容和泄密；安全边界由系统落实，不能只依赖模型自觉。**

#### 8.5.8 视频讲解

ClaudeCode权限系统/安全机制保姆级拆解

https://www.bilibili.com/video/BV1jjdEBSEx1/

---

### **8.6 成本追踪与速率限制**

一个成熟的 Agent 产品和一个玩具项目的核心区别之一，就是有没有完善的**成本控制机制**。你自己做项目可能不太关心花了多少 token，但是一个商业产品必须精确追踪每一次 API 调用的消耗，同时要避免用户在不知情的情况下撞上配额或烧掉大量额度。

这也是 Agent 面试里很容易被追问的一类问题：

\- **你的 Agent 如何控制成本？**

\- **如何监控每次调用和每个会话的成本？**

\- **如何防止用户一次任务把 token 预算打爆？**

\- **如果用户快被限流了，你的系统怎么提前感知？**

很多人回答这类问题时只会说“设置 \`max_tokens\`”或者“限制调用次数”，这其实不够。真正产品级的成本控制，至少要同时回答两个问题：**能不能继续用**，以及**已经消耗了多少**。所以这一节不只是分析 Claude Code 的源码，也是在提炼一套我们自己做 Agent 项目时可以复用的成本监测设计。

Claude Code 的成本控制可以用一个很简单的框架理解：**一边限制速率，一边限制花费**。

\- **限制速率**：回答“按当前消耗速度，还能不能继续调 API”。它关注账号配额、时间窗口、配额消耗速度、限流状态，以及限流后的处理策略。

\- **限制花费**：回答“这次以及这个会话消耗了多少”。它关注 token 用量、模型单价、缓存读写成本、单次查询预算，以及会话级累计。

这两条线合在一起，构成 Claude Code 的成本闭环：前者防止用户把账号配额用爆，后者防止一次会话或一次查询无节制地消耗 token。

读完这一节，应该能得到两类收获：

1. **面试回答思路**：当面试官问“Agent 如何做成本控制”时，可以从速率限制、实时计费、缓存成本、预算保护、会话持久化几个角度系统回答。当面试官问你，如何防止Agent进入无限循环，无限消耗TOKEN时，我们也能够借助今天的问题有一个回答。我也会结合今天的知识，总结一些常见的面试问题。

2. **项目设计启发**：首先我们要有一个意识，就是我们在做自己的Agent项目的时候，需要考虑成本模块。所以你最好能够在你的项目中设计出一个模块专门负责成本控制的。另一方面成本控制模块也可以从两个方面，比如设计两个类。一类专门统计速率，按照现在的消耗，是否需要限速，需要提示消耗过多，及时提醒？第二个类统计花费，持久化每一次请求工作的Token消耗，并从输入、输出、缓存读写、网页搜索、模型维度等方面去统计。这些就是看完本篇给我们的启示。

#### **8.6.1 总览：两条成本控制路线**

调用LLM的API 响应回来以后，Claude Code 会从两个方向处理成本问题：

```Plain Text
API 响应返回
├─ 路线一：限制速率（当前配额消耗速度是否正常）
│  ├─ 输入：服务端返回的配额/限流信号
│  ├─ 处理：解析多时间窗口配额 + 判断消耗速度
│  ├─ 状态：汇总成统一的配额状态
│  └─ 输出：限流状态、提前预警、额外用量/升级/等待策略、企业策略限制
│
└─ 路线二：限制花费（这次到底消耗了多少）
  ├─ 输入：usage token/tool 计数
  ├─ 处理：按模型价格把 usage 换算成费用
  ├─ 状态：费用累加到会话状态 + 按模型统计
  └─ 输出：会话成本累计、Token Budget、保存/恢复
```

一般讲到成本，我们通常会先想到 token 花费，但 Claude Code 这里其实把问题拆成了两层：**按当前速度，服务端配额还能不能继续支撑使用**，以及**客户端已经花了多少钱，具体来讲：**

1. **速率 / 配额问题**：用户的订阅或账号额度是不是快被服务端限制了？如果快被限制，系统如何提前知道？如果已经被拒绝，系统如何决定下一步？

2. **花费 / 账单问题**：本次调用用了多少 token？按当前模型价格折算多少钱？这个会话累计花了多少？单次查询有没有继续跑下去的必要？

换句话说，速率路线关心的是 **quota 按当前消耗速度是否还能支撑继续调用**；花费路线关心的是 **usage 如何换算成成本并累计到会话**。前者主要读服务端返回的限流/配额信号，后者主要读响应里的 usage 统计。

> **项目启发**：做 Agent 成本控制时，不要只设计一个“费用统计器”。更合理的拆法是：一个模块负责**配额/速率状态**，一个模块负责**token/费用累计**。两者数据源不同、处理逻辑不同、触发的保护动作也不同。

下面就按照这两条路线展开。

#### **8.6.2 路线一：限制速率**

这里的“速率”不是传统意义上的“每分钟最多访问多少次 API”。它更接近 **quota burn rate（配额消耗速度）**：按照当前消耗速度，用户离额度上限还有多远？是在正常消耗，还是消耗得太快？

所以速率路线的目标是：**在服务端真正拒绝请求之前，尽早感知配额消耗速度是否异常；如果已经被限流，就给出可执行的处理策略**。它不是一堆零散判断，而是一条连续流程：

```Plain Text
API 调用完成
  ↓
读取服务端配额信号
  ↓
整理成统一的配额状态
  ↓
按短期 / 长期 / 模型等维度判断风险
  ↓
判断当前消耗速度是正常还是偏快
  ↓
如果按当前速度可能提前耗尽：提前预警
  ↓
如果已经被限制：给出等待、加额度、升级、组织协作等处理策略
  ↓
企业策略再做一层能力管控
```

下面按这个流程来看：

1. **API 调用后读取服务端配额信号**

Claude Code 不靠客户端自己猜“用户还能不能继续用”。每次 API 调用之后，服务端都会把当前账号的配额状态返回给客户端。客户端要先读到这些信号，才能知道当前请求到底处于哪种状态：

- 还能正常继续调用；
- 已经接近某个额度上限；
- 已经被服务端限制；
- 虽然基础额度不足，但可能还有额外用量、升级或等待恢复等路径。

这一层解决的是“信息来源”问题：**配额状态必须以服务端判断为准，而不是客户端自己估算**。因为真正决定能不能继续调用的，是服务端的账号、订阅、组织和额度系统。

1. **把零散信号整理成统一状态**

读到配额信号以后，Claude Code 不会让上层业务到处自己判断，而是先把它们整理成统一的配额状态。这个状态只需要回答三个问题：

\- **当前是否可用**：还能不能继续调用。

\- **风险在哪里**：是短期额度、长期额度，还是某类高价模型额度有风险。

\- **下一步怎么办**：继续、提醒、等待、申请额度、升级，还是换一种执行策略。

这一步很关键。因为后面的提前预警、限流处理、任务调度，都不应该直接面对一堆底层信号，而应该面对一个统一状态。否则每个模块都会写一套判断逻辑，最后很容易不一致。

1. **多个维度判断配额消耗速度**

有了统一状态以后，Claude Code 会继续判断“当前消耗速度是否合理”。它不是只看一个“总额度”，而是把配额拆成多个维度：

\- **短期窗口**：防止短时间内爆发式调用，把额度瞬间打满。

\- **长期窗口**：防止一个周期内总用量持续失控。

\- **模型维度**：防止高价模型被过度使用。

\- **额外用量**：判断基础额度不足后，是否还能进入兜底付费路径。

所以速率控制不是简单的“限制调用次数”，也不是只问“现在用了多少”。它真正关心的是：**按照当前速度继续用，会不会比预期更早撞上上限**。短期窗口看短时间内是不是烧得太快，长期窗口看整个周期内是不是会提前耗尽，模型维度看高价模型是不是消耗过快，额外用量则决定额度耗尽后的补救路径。

1. **如果消耗速度偏快，就提前预警**

如果服务端还没有真正拒绝请求，但系统发现消耗速度过快，就会进入提前预警。这里的判断逻辑不是只看“用了多少”，而是看“用掉这些额度时，时间才过去了多少”。

核心思想是：**使用率高 + 时间还早 = 消耗过快**。同样是用掉一部分额度，如果发生在周期刚开始，说明后面很可能会提前耗尽；如果发生在周期快结束，就不一定危险。

所以提前预警做的是中间层保护：它不是直接阻止用户，也不是等到服务端拒绝才处理，而是在“还能用，但按当前速度会提前耗尽”的阶段提醒用户调整节奏。

1. **如果已经被限流，就给出下一步策略**

如果请求已经被服务端限制，Claude Code 也不是简单报错退出，而是把“不能继续”进一步翻译成“接下来能做什么”。常见处理路径包括：

\- **等待恢复**：告诉用户什么时候可以继续，避免无意义重试。

\- **增加额度**：如果账号支持额外用量，引导用户进入额外用量路径。

\- **升级计划**：如果当前套餐额度不够，引导用户升级。

\- **组织协作**：如果是团队或企业账号，可能需要管理员开通额度或调整组织策略。

\- **调整任务**：降低任务规模、换低价模型、拆分任务，减少继续撞限流的概率。

这里的产品价值是：系统不仅知道“不能继续”，还知道“为什么不能继续”以及“下一步怎么继续”。这比简单返回一个错误码更符合 Agent 产品的使用场景。

1. **企业策略做更高层的能力管控**

最后，Claude Code 还会叠加一层企业策略。它和 API 配额不是同一层问题：配额回答“额度够不够”，企业策略回答“组织允不允许”。

比如企业可能允许普通对话，但限制远程执行、外部工具、高价模型或敏感数据相关能力。这类策略一般需要服务端统一配置、客户端本地缓存、定期刷新，并且在策略服务不可用时有明确的降级原则：普通能力可以尽量不阻塞，合规或敏感能力则应该更保守。

**小结：这一条速率路线的核心特点可以概括成四个词：**

1. **服务端可信**：能不能继续调用，以服务端配额状态为准。

2. **状态统一**：不要到处散落判断，先汇总成统一配额状态。

3. **分层判断**：短期、长期、模型、额外用量分开看，判断当前消耗速度是否偏快。

4. **可执行处理**：预警和限流都要给出下一步，而不是只报错。

> **项目启发**：做自己的 Agent 时，可以把速率控制设计成一个独立的 \`Rate Limit Manager\`：它负责读取服务商配额信号、归一化状态、多维度判断消耗速度、触发预警、处理真正限流，并和组织策略联动。这样任务调度、重试、降级、提醒都会围绕同一条流程展开，而不是散落在各个模块里。

#### **8.6.3 路线二：限制花费**

花费路线的目标是：**把每次 API 调用产生的 token / 工具 / 缓存消耗，换算成可理解、可累计、可控制的会话成本**。它和速率路线一样，也不是几个孤立功能，而是一条连续流程：

```Plain Text
API 调用完成
  ↓
读取本次调用的 usage
  ↓
拆成输入、输出、缓存、工具等账单项
  ↓
按模型价格换算成本
  ↓
累加到会话级成本状态
  ↓
用 Token Budget 判断单次查询是否值得继续
  ↓
把会话成本保存下来，下一次恢复
```

下面按这个流程来看：

1. **API 调用后读取 usage**

花费路线的起点，是每次模型调用结束后拿到本次调用的 usage。这里的 usage 不只是一个“总 token 数”，而是成本计算的原始账单数据。

从 Claude Code 的统计口径看，它关心的不是“这次一共用了多少 token”这么粗的数字，而是会把 usage 拆成几类消耗来源：

\- **输入 token**：这次请求送进模型的上下文有多长。

\- **输出 token**：模型这次生成了多少内容。

\- **缓存读取 token**：有多少上下文是从缓存里复用的。

\- **缓存写入 token**：有多少上下文被写入缓存，供后续复用。

\- **网页搜索次数**：本次调用是否触发了额外计费的搜索能力。

\- **模型名称**：这些 token 是在哪个模型上消耗的。

\- **本次费用**：这些消耗按当前模型价格折算后是多少钱。

这一层解决的是“成本数据从哪里来”的问题：**没有结构化 usage，就没有后面的计费、累计、预算和优化**。

所以 Claude Code 总结 usage 的第一步，其实是在回答：**这次模型调用的钱，到底花在输入、输出、缓存、搜索，还是高价模型上？**

1. **把 usage 拆成可计费的账单项**

读到 usage 之后，Claude Code 会把一次调用拆成多个账单项，而不是只记录一个 token 总数：

\- **输入 token**：输入越长，上下文成本越高。

\- **输出 token**：输出通常比输入更贵，长回答会明显增加成本。

\- **模型类型**：不同模型单价不同，高价模型需要单独观察。

\- **服务端工具**：网页搜索这类能力可能有额外计费。

\- **缓存读写**：缓存命中和缓存写入的成本差异很大。

这一步的意义是把“模型调用”变成“结构化账单”。只有账单项拆得足够清楚，后面才能知道成本到底来自哪里：是输入上下文太长，输出太多，高价模型用太频繁，还是搜索和缓存策略没有设计好。

> **项目启发**：我们自己做项目时，不能只说“我要统计 token”，还要说清楚统计哪些 token（比如输入，输出，Tool,SKILL）等、按什么维度聚合、最后要回答什么成本问题。

1. **按模型价格换算成真实成本**

有了账单项之后，Claude Code 会结合模型价格，把 token、缓存和搜索消耗换算成金额。这里要注意两点：

第一，**不同模型价格不同**。同样的 token数，用在便宜模型和高价模型上，最终成本可能完全不同。所以成本计算必须带上模型维度，不能只看 token总数。

第二，**缓存也要进入成本模型**。缓存写入通常更像一次“前期投入”，后续缓存读取才是“节省成本”。所以 Prompt Cache 不能只当作性能优化，它本身也是成本模型的一部分。

完整公式不需要记具体数字，只要抓住一个原则：**总费用 = 输入成本 + 输出成本 + 缓存写入成本 + 缓存读取成本 + 搜索等额外成本**。如果遇到未知模型，也应该有默认估算和异常记录，避免成本计算直接断掉。

1. **累加到会话级成本状态**

单次调用算完以后，费用不会只停留在这一轮请求里，而是会累加到会话状态。Claude Code 这里有一个很重要的设计：**它不是只维护一个总费用，而是按模型维护一份 usage 汇总**。

也就是说，每个模型都会有自己的结构化账单，大致包括：

\- **输入 token 总数**：这个模型一共吃进了多少上下文。

\- **输出 token 总数**：这个模型一共生成了多少内容。

\- **缓存读取 token 总数**：这个模型复用了多少缓存上下文。

\- **缓存写入 token 总数**：这个模型创建了多少缓存上下文。

\- **网页搜索次数**：这个模型触发了多少次搜索类额外成本。

\- **成本总额**：这个模型累计花了多少钱。

\- **上下文窗口 / 最大输出能力**：这个模型本身的容量边界。

在这个基础上，会话级追踪再把各个模型的账单汇总起来：

```Plain Text
会话级追踪：
├── 总费用
├── 总输入 / 输出 token
├── 缓存读取 / 缓存写入 token
├── 网页搜索次数
├── 工具耗时
├── API 调用耗时和重试成本
├── 代码修改规模
└── 按模型分类的使用量
```

这一步解决的是“成本归属”问题。只看全局总成本是不够的，至少要能回答：这个会话花了多少钱？哪个模型最贵？输入贵还是输出贵？缓存有没有省钱？搜索有没有带来额外成本？哪类任务最容易爆预算？

1. **用 Token Budget 判断单次查询是否值得继续**

会话级累计解决的是“已经花了多少”，但还不够。Agent 最大的问题是：一次任务可能不断续跑、不断调用工具、不断扩上下文，最后在用户没注意的时候消耗大量 token。

所以 Claude Code 还有单次查询级别的预算管理。它不只是看“有没有超过上限”，还会看“继续跑有没有收益”：

- 如果预算还比较充足，而且本轮输出仍然有明显增量，就允许继续。
- 如果已经接近预算上限，就停止继续消耗。
- 如果连续几轮输出增量都很低，说明进入收益递减，也应该停止。

这一步的关键是：**成本控制不能只看上限，还要看收益**。如果模型已经在原地打转，哪怕还没完全用完预算，也应该及时停下来，让用户重新确认方向。

> 这里对我们也是一个很好的启示。就是我们怎么防止Agent无限调用。我们知道我们讲的ClaudeCode也好，Openclaw也好，它内部用了React,是自己在循环中思考，推理的。所以如何防止他无限调用呢？设置最大次数我觉得大家都可以想到吧，但是看到这里，我们就有了新的思路：可以从预算以及输出增量的角度，前者从成本上控制，后者从收益上控制是否需要继续迭代。我也会将这个思路总结到后面面试题中。

1. **保存并恢复会话成本**

最后，费用数据不能只存在内存里。Claude Code 会把会话费用保存到本地，确保终端关闭或会话切换后，成本统计不会直接丢失。

保存的重点不是某个具体字段，而是保留会话成本上下文：累计费用、token 用量、模型分布、工具耗时、任务规模、会话 ID 等。恢复时再通过会话 ID 判断是不是同一个会话：如果匹配，就接着之前的成本状态继续累计；如果不匹配，就从零开始，避免串账。

这一步解决的是“成本连续性”问题：用户关掉终端再回来，仍然能接上同一个会话的成本上下文。

**小结**

**这一条花费路线的核心特点可以概括成四个词：**

1. **账单结构化**：每次调用都拆成输入、输出、缓存、工具、模型等账单项。

2. **价格模型化**：不同模型、缓存读写、网页搜索等额外消耗要进入同一套成本公式。

3. **会话可观测**：成本要按会话、模型、工具、任务类型累计，而不是只记总数。

4. **预算可中断**：单次任务不仅看是否超预算，还要看继续运行是否还有收益。

> **项目启发**：做自己的 Agent 时，可以把花费控制设计成一个独立的 \`Cost Manager\`：它负责采集 usage、拆账单项、换算费用、按会话累计、判断单次任务是否值得继续，并把成本状态持久化。这样成本控制就不只是日志，而是能参与任务停止、模型选择、缓存优化和后续分析的产品能力。

**4.4.5.4 设计思想总结**

现在再回到最开始的主线：Claude Code 的成本控制其实就是两条路线。

```Plain Text
限制速率：控制“按当前速度还能用多久”
  - 多时间窗口配额
  - 配额消耗速度判断
  - 提前预警
  - 限流后的升级 / 额外用量 / 等待策略
  - 企业策略限制

限制花费：控制“已经消耗了多少”
  - usage 实时计费
  - 模型定价表
  - Prompt Cache 读写成本
  - 会话级累计
  - Token Budget
  - 会话费用持久化与恢复
```

这两个方向解决的是不同问题：

\- **速率路线**更像“配额消耗速度保护”：判断用户按当前速度会不会提前撞上限流墙。

\- **花费路线**更像“账单保护”：防止一次调用、一次会话、一次查询无节制地消耗。

面试时如果被问“Agent 项目怎么做成本控制”，可以按这个框架回答：

1. **先分两条线**：限制速率 + 限制花费，不要混在一起讲。

2. **限制速率**：服务端给出配额状态，客户端结合时间窗口判断消耗速度是否偏快，提前预警，并在限流后提供升级/额外用量/等待策略。

3. **限制花费**：每次 API 调用后用 usage + 模型定价表算成本，包含 Prompt Cache 和网页搜索等额外成本，按会话/模型累计。

4. **加预算控制**：单次查询 Token Budget、会话级累计、会话持久化恢复。

5. **企业管控**：团队或企业场景下，还可以通过组织策略远程禁用特定能力。

这样讲比单纯说“设一个 max_tokens”更完整：它同时覆盖了配额、成本、预算和企业管控。

#### **8.6.4 面试问题汇总**

**Q1：你的 Agent 如何做成本控制？**

可以先把成本控制拆成两条线：**限制速率**和**限制花费**。

第一条线是速率检测，负责判断配额消耗速度。系统会读取服务商返回的配额状态，结合短期、长期、模型等窗口判断当前消耗是否偏快，以及按这个速度继续使用会不会提前撞上服务端配额上限。如果只是接近风险区间，就提前预警；如果已经被限流，就给出等待恢复、增加额度、升级计划或调整任务的处理策略。

第二条线是花费统计，负责回答“已经消耗了多少”。每次模型调用后，系统会根据 usage 拆出输入 token、输出 token、缓存读取、缓存写入、网页搜索次数和模型信息，再结合模型定价表换算成本，并按会话和模型维度累计。这样不仅能看到总花费，还能知道钱具体花在输入、输出、缓存、搜索还是高价模型上。

最后还要加一层预算保护，比如单次查询的 Token Budget。它不只是限制最大 token，还会判断 Agent 内部续跑是否还有明显收益，避免一次任务不断循环、持续烧 token。

**Q2：如何监控 Agent 的成本？**

我会分三层做成本监控。

第一层是**单次调用级别**。每次模型调用结束后，都记录结构化 usage，包括模型名、输入 token、输出 token、缓存读取、缓存写入、工具调用情况和估算费用。这样可以知道单次请求的钱具体花在哪里。

第二层是**会话聚合级别**。把多次调用按会话、模型、用户、任务类型聚合，同时补充工具耗时、API 耗时、代码改动规模等信息。这样可以回答“这个会话总共花了多少钱”“哪个模型最贵”“哪类任务最容易爆预算”。

第三层是**成本归因级别**。拿到聚合数据后，要进一步分析成本来源：是高价模型用太多，还是输入上下文太长？是输出太多，还是缓存命中率太低？是搜索等额外能力带来了额外成本，还是某类任务本身就更贵？

这样监控成本就不是只看一个总金额，而是能定位成本来源，并为后续优化模型选择、上下文裁剪、缓存策略和工具使用提供依据。

**Q3：如果一次 Agent 任务不断循环，怎么防止它烧 token？**

可以分三层控制。

第一层是**硬性预算控制**。给一次用户任务设置 token budget，持续记录这次任务已经消耗了多少 token、还剩多少预算。如果已经接近预算上限，就停止继续自动续跑，避免一次任务无限消耗。

第二层是**续跑次数控制**。Agent 内部可能会经历多轮“模型思考 → 工具调用 → 读取结果 → 再次思考”的循环，所以要记录已经自动续跑了几次。即使还没用完预算，也不能让它无限循环。

第三层是**收益递减判断**。只限制最大轮数还不够，因为有些任务可能前几轮就已经没有明显产出了。Claude Code 的思路是看每轮新增输出是否还有明显增量：如果连续几轮新增内容都很少，说明模型可能在原地检查、重复总结或低价值补充，这时继续跑的收益已经很低，就应该提前停止。

所以更完整的答案不是“设置最大轮数”这么简单，而是：**预算控制负责限制成本，续跑次数负责限制循环长度，输出增量负责判断继续运行是否还有收益**。这三者结合，才能比较可靠地防止 Agent 在一个任务里持续烧 token。

**Q4：如果让你设计一个 Agent 成本监测模块，你会怎么拆？**

我会拆成五个部分：

1. **Usage Collector**：采集每次模型调用的输入 token、输出 token、缓存读写、网页搜索次数和模型信息。

2. **Cost Calculator**：根据模型定价表、缓存读写、网页搜索等额外成本计算费用。

3. **Budget Manager**：维护请求级、会话级、用户级、模型级预算。

4. **Rate Limit Manager**：解析服务商配额信号，维护多时间窗口配额和提前预警。

5. **Persistence & Analytics**：把会话成本持久化，并按模型、工具、任务类型做聚合分析。

这样设计的好处是，成本控制不再是一个零散的日志功能，而是一个完整的产品能力：能监控、能预警、能解释、能恢复，也能给后续优化提供数据。

### 8.7 CC源代码

我用夸克网盘给你分享了「ClaudeCode泄露源码」，点击链接或复制整段内容，打开「夸克APP」即可获取。

/\~0f8b3YAgIw\~:/

链接：https://pan.quark.cn/s/45afcbfd2720

## 4. DeepSeekRuntime

### 9.1 DeepSeekHarness是什么？

虽然它叫 DeepSeek Harness（简称 `dsh`），但大家不要被“Harness”这个词误导。站在使用者的角度，它和我们熟悉的 Claude Code、Codex、OpenClaw 一样，本身就是一个可以直接使用的 Agent，而不是一个只能被其他 Agent 调用的底层 Harness 库。

一个完整的 Agent，可以简单理解为：

```Plain Text
Agent = LLM + Harness
```

这里的 LLM 是负责理解、推理和决策的“大脑”；Harness 则是模型外面的执行系统，负责给模型准备上下文、提供工具、管理会话，并把模型的决策真正执行出来。Claude Code、Codex、OpenClaw 都可以用这个公式理解，DeepSeek Harness 也是一样的。它内部包含模型调用，并围绕模型实现了一套完整的 Agent Loop，而不是只有 Harness、没有模型的“半成品”。

在功能上，DeepSeek Harness 重点处理的事情也和其他 Agent 类似：它会组装系统提示词和会话上下文，调用大模型进行推理，让模型读取和修改文件、搜索内容、运行 Shell 命令、调用各种工具，并根据工具返回的结果继续执行任务。同时，它还负责会话记录、上下文压缩、权限控制、沙箱、子 Agent 和任务状态等能力。也就是说，用户给它一个任务后，它可以像 Claude Code 或 Codex 一样，在工作区中自主完成多步操作。

DeepSeek Harness 真正特殊的地方，不在于“它是不是 Agent”，而在于“它是怎样构建 Agent 的”。与 Claude Code、Codex 等产品相比，它主要有下面两个特点：

1. **一切皆插件（Everything is a plugin）**
2. Claude Code、Codex 等产品提供的是相对完整、固定的成品体验，很多底层模块由官方预先决定；DeepSeek Harness 则更强调开源、模块化和可重新组合。
3. 这里的“插件”不只是给 Agent 增加的几个外部工具。模型适配器、工具系统、文件操作、Shell、沙箱、权限策略、会话持久化、子 Agent、Agent Loop，甚至 Web UI，都可以由插件提供或替换。因此，DeepSeek Harness 不只是允许开发者“给 Agent 加几个工具”，而是允许开发者重新组合 Agent 本身。这也是它最核心的架构特点。
4. **以 Web UI 为主要交互形式**
5. 与 Claude Code、Codex 常见的终端交互不同，DeepSeek Harness 当前把 Web UI 作为主要入口。用户可以直接在浏览器里与 Agent 对话、查看完整的执行轨迹并管理工作区，整体使用门槛更低，任务执行过程也更加直观。

![图片展示了DeepSeek Harness的Web UI界面。左侧有“工作台”“我的对话”等选项，右侧上方有“新对话”按钮，中间显示“探索未至之境”及“DeepSeek发送消息”输入框，底部有“+”图标。该图与上下文紧密相关，直观呈现了DeepSeek Harness作为开源Agent，以Web UI为主要交互形式的特点，与上下文提到的用户可在浏览器里与Agent对话、查看执行轨迹等内容相契合。](04_DeepSeekRuntime_images/B-开源框架解读：Dee/GSqdbLljjoUWlQxONWkczk0Jn2e.png)

所以，对 DeepSeek Harness 最准确的理解是：**它首先是一个能够直接工作的开源 Agent，同时也是一套高度插件化、可以重新组合的 Agent 运行平台。** 前者说明它和 Claude Code、Codex、OpenClaw 属于同一类产品；后者则是它区别于这些产品的核心特点。

目前 DeepSeek Harness 仍处于 Developer Preview（开发者预览）阶段，项目会快速迭代，也可能出现破坏兼容性的改动。现阶段我们学习它，重点不是背每一个功能的用法，而是理解它如何通过“一切皆插件”的方式重新组织模型、工具、会话、执行环境和交互界面。

我说了你可能感受不出来，你想知道它是啥，可以看看网上的各种使用视频或者自己用就知道了。更直观地弄清楚DSH是什么，可以看看这个视频： 

[嵌入视频](https://player.bilibili.com/player.html?bvid=1ACbi6DEvC&spm_id_from=333.337.search-card.all.click&vd_source=144bec9c3f54e465073138bed788be1b)

---

### 9.2 整体架构

我们解析 PI Agent、Claude Code、OpenClaw、Hermes 等开源 Agent 时，通常会先用一张架构图了解系统的整体运行方式。DSH 的宏观结构与它们有相似之处：外部请求进入 Agent 系统，Agent Loop 按照 ReAct 范式反复调用模型和工具，会话系统则保存消息与执行事实。不过，DSH 最鲜明的区别是：这些组件都运行在 Cordis 插件体系中，连 Agent Loop、模型适配器和界面本身也可以由插件提供或替换。

![这张图对应文档中开源框架DeepSeek Harness的整体架构内容，核心围绕Cordis Runtime的共享上下文展开。图中明确标注Cordis Runtime是全局插件运行时，可协调服务、类型事件、作用域等，所有组件均处于该插件体系中，这也是该框架的鲜明区别。图的左侧是供用户使用的Gateway/Entry Adapters，含Web、ACP等接入方式；中间的主Agent Loop核心流程为输入、提示组装、调用LLM与工具生成结果，还有子Agent Loop分支；右侧是面向用户客户端的Output Adapters，最终生成最终响应；底部还有记录会话相关事件的Session Event Log模块，完整呈现了DSH的运行架构逻辑。](04_DeepSeekRuntime_images/B-开源框架解读：Dee/JS3VbK6VtoaM00xbDHBcVtY9nmi.png)

这张图可以分成四部分理解。

1. **Cordis Runtime 是全局运行底座**：最外层的 Cordis Runtime 包围整个系统，负责组织插件、注册服务、分发事件并管理生命周期。上方的 Profiles、Bundles 和 Patches 表示 DSH 在启动时如何选择和组合插件，它们不是用户请求依次经过的业务流程。
2. **不同入口汇入同一套 Agent 能力**：用户可以通过 Web、ACP、SDK 或 CLI 进入系统。Web 模式会经过 Connection、API Gateway 等组件；ACP、SDK 和 Headless 则各有自己的入口适配器。它们不一定经过同一个网络网关，但最终都会通过 `ctx.agents` 创建、恢复或驱动 Agent。
3. **LLM 和工具都在 Agent Loop 中协作**：主 Agent Loop 从 Inbox 获取消息，组装 Prompt 并调用 LLM。模型如果发出 Tool Call，Tool Runtime 就执行对应工具，再把 Tool Result 交回模型，直到任务完成。Subagent Tool 也是一种工具入口，但它启动的不是一次普通函数调用，而是一个拥有自身 LLM 与工具循环的 Child Agent Loop；子 Agent 的结果最终作为 Tool Result 返回主循环。
4. **结果输出与会话记录是两条关系**：Agent Loop 的最终回答经过 Output Adapters，以 WebSocket、ACP、SDK 或 stdout 等形式返回用户；与此同时，Agent Loop 会把用户消息、模型回答、工具调用、工具结果和生命周期事件写入 Session Event Log，并从中重建后续请求需要的会话历史。Session Event Log 是内部事实与历史来源，不等于把原始日志直接返回给用户。

因此，DSH 的运行主线可以概括为：**外部入口接收请求，`ctx.agents` 将请求交给 Agent，Agent Loop 在 LLM 与工具之间循环执行，最终结果经对应适配器返回；Cordis 则在全局范围内组织和协调参与这一过程的所有插件。**

这张图只展示了最核心的宏观关系，真实实现还包括上下文压缩、权限审批、沙箱、后台任务、不同工具模式以及多种 Subagent Provider 等机制。接下来我们先从 DSH 最关键的设计理念——“一切即插件”开始展开。

### 9.3 核心特性

#### 9.3.1 一切即插件

DeepSeek Harness 最核心的设计理念是 **Everything is a Plugin（一切皆插件）**。很多系统所说的“插件”，通常只是允许开发者在一个固定核心外面增加 MCP、搜索工具或 Skill；DSH 的不同之处在于，它把组成 Agent 的主要能力乃至传统意义上的核心部分，也放进了同一套插件体系。

从 DSH 的整体结构来看，插件大致覆盖以下几类能力：

1. **模型与推理流程**：模型适配器负责接入 DeepSeek 或其他模型；Agent Loop 负责驱动“调用模型、执行工具、读取结果、继续下一步”的循环；上下文压缩插件负责在会话接近模型窗口上限时生成摘要或裁剪工具结果。这里最特别的是 Agent Loop 本身也以独立插件包提供，而不是不可替换的固定内核。
2. **工具与执行能力**：工具注册表、文件系统、文件编辑器、Shell、持久终端、LSP、Web Search、Web Fetch、MCP、Skill 和子 Agent 等均由插件提供。替换文件系统或进程执行环境后，依赖这些服务的工具也可以随之迁移，而不必分别改写每个工具。
3. **会话与状态管理**：Session Event Log、会话持久化、查询、回放、标题、统计以及普通 Storage 都由不同插件组合。比如会话持久化可以采用 JSONL 或 SQLite，实现可以变化，但仍需遵守统一的 Session 事件与恢复约定。
4. **权限与运行环境**：用户审批、权限预设、文件访问策略、进程 Sandbox 和凭据管理同样由插件提供。它们不是写死在某个工具里的判断，而是通过统一的服务和执行扩展点参与工具调用流程。
5. **任务编排与后台能力**：Goal、Todo、Workflow、后台 Job、调度以及不同类型的 Subagent Provider 都可以按运行场景装配。Standard、Code、Minimal、Creator 等模式，本质上也是不同的插件与配置组合。
6. **交互入口与界面**：Web Server、Headless Runner、ACP、API，以及浏览器中的侧边栏、会话界面和工具结果视图都属于可组合模块。也就是说，不仅 Agent 的“脑、手和记忆”可以替换，用户看到的 Web UI 也不是固定在核心中的唯一界面。

因此，DSH 并不是先写好一个不可改变的 Agent 核心，再允许开发者在外围增加几个工具。它采用 Cordis 作为插件运行底座，把模型、Loop、工具、状态、安全、任务编排和 UI 拆成遵守统一加载与生命周期规则的模块，再由 Profile 和配置将它们组合成一套可运行的系统。

这里的“一切”也不是指任意代码都能不受限制地塞进系统。DSH 会预先定义服务接口、Registry、事件或 UI Slot 等扩展位置，插件必须满足相应约定；它强调的是主要系统能力都采用统一的插件方式实现，而不是系统不存在任何结构和接口限制。

看到这里，你可能会想：DSH 为什么能把模型、Agent Loop、工具、会话、安全策略乃至 Web UI 都做成可替换、可组合的插件？要理解这种能力是如何实现的，就要进入 DSH 插件体系的核心——Cordis。

##### 9.3.1.1 Cordis 是什么？

Cordis 是一个通用的 TypeScript 插件运行框架，并不是专门为 DSH 编写的 Agent 框架。它负责插件加载、服务注册、依赖解析、作用域隔离、生命周期管理和资源清理，并配合 HMR 实现运行时更新。DSH 的做法，是把自己的各项 Agent 能力按照 Cordis 的插件规范实现，然后交给 Cordis 统一组织。

![图片展示了Cordis插件运行时与DSH插件化原理流程图。从Profile/cordis.patch.yml等配置文件开始，经Cordis Loader读取模块读取与配置，到Registry为每个插件实例创建Fiber，Fiber状态流转，再到Context服务与Registry注册能力，最后是各组件能力组合完成DSH。还呈现了HMR动态更新流程，包括代码或配置变化、HMR检测、定受影响插件、Fiber进入Unloading、Loader/Registry注册替代插件等步骤。该图与上下文紧密相关，直观呈现了DSH与Cordis插件运行的原理流程。](04_DeepSeekRuntime_images/B-开源框架解读：Dee/OUIDbVLAooJkMtxdXLyco73cnBg.png)

所以两者的关系可以概括为：

```Plain Text
Cordis：负责组织和管理插件的通用运行时
DSH：由一组 Cordis 插件组合出来的 Agent 系统
```

换句话说，DSH 不是等 Cordis 运行完成后再去调用它；DSH 本身就是 Cordis 所管理的那组插件共同组成的系统。

##### 9.3.1.2 静态组装：DSH 是如何被拼装起来的？

图的上半部分表示 DSH 启动时的静态组装流程。这里的“静态”不是指插件不能变化，而是指系统先依据当前配置完成一次确定的插件装配：

```Plain Text
Profile / cordis.patch.yml 声明插件
→ Loader 读取插件模块与配置
→ Registry 为插件实例创建 Fiber
→ 插件向 Context 服务槽或专用 Registry 注册能力
→ 所有能力共同组成可运行的 DSH
```

###### 9.3.1.2.1 Profile / cordis.patch.yml：声明系统需要哪些插件

Profile 决定当前运行的是 Web、Headless 还是其他自定义形态；Bundle 和 `cordis.patch.yml` 则列出需要加载的插件及其配置。模型、工具、Session、Agent Loop、Sandbox 和 Web UI 等能力，都从这里进入装配流程。

因此，配置文件解决的是第一个问题：**这一套 DSH 由哪些插件组成？**

###### 9.3.1.2.2 Loader：找到并读取插件

Loader 根据配置解析插件包，读取并校验插件配置，再把可执行的插件模块交给 Registry。它解决的是：

- 插件代码在哪里；
- 应当使用哪份配置；
- 配置能否通过插件声明的 Schema 校验。

###### 9.3.1.2.3 Registry 与 Fiber：组织并运行插件实例

Registry 保存“插件模块与运行实例”的对应关系。一个插件可以在不同配置或作用域中运行多次，因此同一个插件可能对应多个 Fiber。

Fiber 是单个插件运行实例的生命周期容器，不是线程，也不是插件业务对象本身。Registry 为插件创建 Fiber 后，Fiber 负责：

```Plain Text
创建插件专属子 Context
→ 读取并检查 inject 依赖
→ 等待依赖服务可用
→ 通过 Context 解析服务
→ 执行 apply 或 Service 构造函数
→ 收集 Effect 与清理函数
→ 进入 Active
```

Fiber 的状态可以简化为：

```Plain Text
Pending（等待依赖）
→ Loading（加载）
→ Active（运行）
→ Unloading（卸载）
→ Disposed（结束）或 Reload（重载）
```

可以把两者简单区分为：**Registry 保存和管理插件及其 Fiber，Fiber 托管单个插件实例的运行过程。**

###### 9.3.1.2.4 Context 服务槽与专用 Registry：连接各项能力

插件启动后，通过 Context 获取自己依赖的服务，并注册自己提供的能力。例如：

```Plain Text
模型插件 → 注册模型适配器
工具插件 → 注册模型可调用的工具
Session 插件 → 提供会话和持久化能力
Agent Loop 插件 → 提供 Agent 创建与驱动能力
UI 插件 → 注册浏览器端组件或交互入口
```

`Context` 是受作用域控制的服务访问环境。插件通过 `ctx.llm`、`ctx.tools`、`ctx.sessions` 等统一入口访问能力，不需要直接绑定某个具体实现。专用 Registry 则保存同一类能力下的多个注册项，例如工具或模型适配器。

当这些插件完成注册后，它们不是“被 DSH 使用的外部组件”，而是**共同组成了 DSH 本身**。

##### 9.3.1.3 动态更新：运行中的插件如何适应变化？

图的下半部分表示动态更新。Cordis 有两种不同但相互配合的变化机制：**响应式依赖**与 **HMR**。

###### 9.3.1.3.1 响应式依赖：服务变化沿依赖关系传播

插件使用 `inject` 声明自己依赖哪些服务。这个依赖不是只在启动时检查一次，而是 Fiber 能否持续运行的条件。

假设插件 B 依赖服务 A：

```Plain Text
A 可用
→ B 的依赖满足，Fiber 进入 Active

A 消失或实现被替换
→ B 的 Fiber 重新检查 inject
→ 当前运行状态被卸载

新的 A 可用
→ B 的依赖重新满足
→ B 被重新激活或重载，并再次注册能力
```

这对应图中从“Context 服务槽 / Registry”返回 Fiber 内部“检查 inject 依赖”的**虚线箭头**。它表示服务的出现、消失或实现变化会自动传播给依赖它的插件。这里通常是已有 Fiber 发生状态转换，不一定创建新的 Fiber。

###### 9.3.1.3.2 HMR：代码或配置变化触发插件替换

HMR 是 Hot Module Replacement，即热模块替换。它处理的不是服务依赖本身，而是插件代码或配置文件发生变化：

```Plain Text
代码或配置变化
→ HMR 检测并定位受影响插件
→ 旧 Fiber 进入 Unloading
→ Effect 清理旧服务、监听器和资源
→ Loader / Registry 注册替代插件
→ Registry 为替代插件创建新 Fiber
→ 新插件重新注册能力
```

这对应图下方的 HMR 虚线框，以及从最后一个节点返回上方第 3 步的**实线箭头**。这条箭头表示替代插件重新进入正常装配流程，而不是 HMR 自己直接完成插件运行。

###### 9.3.1.3.3 Effect：保证旧插件能够被干净卸载

无论变化来自响应式依赖还是 HMR，插件在卸载前都需要清理自己产生的副作用。Cordis 用 Effect 把资源注册与撤销操作绑定到所属 Fiber：

```Plain Text
插件加载：注册服务、工具、事件监听、连接和定时器
插件卸载：按相反顺序注销并释放这些资源
```

因此，Effect 是动态更新能够成立的基础。如果旧插件卸载后仍残留监听器、连接或服务，新旧实现就可能同时生效，插件系统也会逐渐失去一致性。

###### 9.3.1.3.4 响应式依赖与 HMR 如何配合？

响应式依赖与 HMR 很像，但职责不同：

- **HMR 是变化的触发与替换流程**：代码或配置变化后，卸载旧插件并加载替代插件；
- **响应式依赖是变化的传播机制**：某个服务变化后，所有依赖它的插件都会重新检查自己的运行条件。

例如，HMR 替换一个 LLM 插件时，旧 LLM 服务先消失，新 LLM 服务随后注册；这个服务变化又会通过响应式依赖传播给依赖 LLM 的其他插件，使它们自动卸载并重新激活。

最终，整张图可以用两条主线概括：

```Plain Text
静态组装：配置 → Loader → Registry / Fiber → Context 注册能力 → 组成 DSH
动态更新：服务变化或 HMR → Fiber 卸载与清理 → 重新加载和注册 → 更新 DSH
```

所以，DSH 的“一切皆插件”不是简单地提供一个插件市场，而是先把主要能力设计成可注册的插件，再由 Cordis 负责这些插件的**初始组装、依赖协调、生命周期管理、资源撤销和运行时重组**。需要注意，这也不代表任意代码都能直接接入：插件仍须满足对应服务、Registry、事件或 UI Slot 的约定。

---

### 9.4 面试问题

#### 9.4.1 最近的 DSH 你关注了吗？请简单谈谈你的理解

> **点评**
> 
> 这是面试官询问 DSH 时很常见的第一个问题，主要用于判断候选人是否关注近期技术动态，以及是否形成了自己的基本认识。回答时按“定位 → 功能 → 差异 → 评价”四个方面简单展开即可，不需要一开始就深入细节。如果面试官对某个差异点感兴趣，通常会继续追问。下面的参考答案重点提到插件化和 append-only Session Event Log，因此后面也补充了这两个概念的常见追问。

**答题思路：定位 → 功能 → 差异 → 评价**

1. **定位**：先使用官方表述，说明 DSH 是 DeepSeek AI 开源的 Agent Harness；它既提供可以直接运行的 Agent 应用，也可以作为组装不同 Agent 形态的运行平台。不要直接把它限定为 Coding Agent。
2. **功能**：概括它如何把模型变成能够执行任务的 Agent，包括上下文组装、模型调用、工具执行、会话管理、权限控制、沙箱、子 Agent，以及 Web、Headless、ACP、SDK 等入口。
3. **差异**：重点说明“**一切皆插件**”。模型、工具、Session、存储、Sandbox、UI，甚至 Agent Loop 都由 Cordis 插件体系组织；另一个特点是 **append-only Session Event Log**。它不是辅助日志，而是会话的唯一事实来源；模型消息历史从事件中派生，进入模型请求的内容必须能够从日志重建。
4. **评价**：肯定其架构与开放性的价值，同时说明它仍处于 Developer Preview，产品成熟度、兼容性、安全治理和插件生态还需要继续验证。

**参考答案**

我关注了 DSH。按照官方定义，它是 DeepSeek AI 开源的一套 Agent Harness。它不是只供其他 Agent 调用的底层库：目前已经提供 Web UI、Headless、ACP 和 SDK 等运行入口，可以直接创建并运行 Agent；同时，它的目标也不局限于某一种编程产品，而是提供一套可以重新组合的 Agent 运行平台。

从功能上看，DSH 负责模型之外的完整执行系统。它会组装系统提示词和会话上下文，调用 DeepSeek 或其他模型，让模型使用文件、Shell、搜索、LSP、MCP 等工具，并根据工具结果继续执行。它还提供 Session 持久化、上下文压缩、权限审批、Sandbox、Workflow 和子 Agent 等能力。

我认为它最有辨识度的设计是 **Everything is a Plugin**。很多 Agent 产品只允许扩展工具，而 DSH 把模型适配器、工具系统、Session、存储、权限、Sandbox、UI，甚至 Agent Loop 本身都放进 Cordis 插件体系，通过 Profile 和配置进行组合。

另一个值得关注的点是它的 **append-only Session Event Log**。它并不只是为了在界面上查看轨迹，而是整个会话的唯一事实来源：用户消息、模型输出、工具调用、工具结果和其他模型可见输入都以事件追加，过去的事件不会被原地改写；LLM 消息历史则从这份日志派生，而不是另存一份消息数组。DSH 还要求“模型可见即已记录”，也就是进入模型请求的内容必须能从日志重建。恢复、Fork、回放和审计都是建立在这套设计之上的派生能力。

我的整体评价是，DSH 当前最重要的价值并不是证明它已经全面超过 Claude Code 或 Codex，而是展示了一种更开放、更可组合的 Harness 架构。它适合研究如何构建和定制 Agent Runtime，但目前仍处于 Developer Preview，接口和数据格式可能发生破坏性变化，实际稳定性、默认安全边界以及社区插件质量还需要继续观察。

##### 9.4.1.1 追问：DSH 是如何实现插件化的？

**参考答案**

DSH 使用 Cordis 作为插件运行底座，并把模型、工具、Session、Sandbox、Agent Loop 和 UI 等能力都实现为 Cordis 插件。启动时，Profile 和 `cordis.patch.yml` 声明需要哪些插件；Loader 读取模块和配置；Registry 为每个插件运行实例创建 Fiber；Fiber 检查 `inject` 依赖，通过 Context 解析服务，再执行插件的 `apply` 函数或 Service 构造函数。插件随后向 Context 服务槽或专用 Registry 注册能力，所有注册结果共同组成 DSH。

Cordis 不仅负责加载插件，还负责运行时生命周期。Fiber 管理单个插件实例从等待依赖、加载、运行到卸载或重载的状态；Effect 则记录服务、工具、事件监听器和连接等副作用的清理方法。服务出现、消失或实现变化时，响应式依赖会让相关 Fiber 重新检查运行条件；代码或配置变化时，HMR 会卸载旧插件、清理资源并加载替代插件。因此，DSH 的插件化不仅是接口抽象和动态注册，还包含依赖协调、作用域、生命周期和运行时重组。

##### 9.4.1.2 追问：什么是 append-only Session Event Log？它的设计理念是什么？

**参考答案**

DSH 不把会话维护成一份可以随时修改的消息数组，而是把用户消息、模型输出、工具调用、工具结果、权限变化和上下文压缩等事实记录为一串只能追加的类型化事件。已经写入的历史事件不会被原地修改；发现旧信息有误时追加纠正事件，需要压缩时追加摘要或投影变化，Fork 时则从某个历史位置建立新的分支。

这份日志也不是用于旁路审计的副本，而是会话的唯一事实来源。LLM 消息历史、Trajectory、恢复、Fork 和 Replay 都从同一事件流派生。DSH 进一步规定“模型可见即已记录”：凡是进入模型请求并可能影响模型决策的内容，都必须能够从日志重建。

这套设计的核心价值是保持历史事实不被后续操作覆盖，避免“真实运行状态”和“审计日志”形成两份可能不一致的数据，同时让系统能够准确回答某一步模型看到了什么、调用了什么工具以及从哪里开始出错。

---

#### 9.4.2 请介绍一下 DSH 的核心设计理念

**答题思路：Cordis 插件化 + append-only Session Event Log**

这个问题可以从两个方面回答：第一，DSH 如何利用 Cordis 落地 Everything is a Plugin，把 Agent 的主要能力拆成可组合、可替换并受统一生命周期管理的插件；第二，DSH 如何使用 append-only Session Event Log 保存不可改写的运行事实，并把它作为会话的唯一事实来源。前者解决系统能力如何组合和演进，后者解决运行历史如何保持一致、可重建和可审计。

**参考答案**

我认为 DSH 的核心设计理念主要体现在两个方面。

第一个是 **Everything is a Plugin（一切皆插件）**。DSH 不是在一个固定 Agent 核心外面增加少量工具，而是把模型适配器、工具系统、文件与进程能力、Session、存储、权限、Sandbox、子 Agent、Agent Loop，甚至 Web UI 都放进 Cordis 插件体系。Profile 和 `cordis.patch.yml` 决定当前系统加载哪些插件，Cordis 则使用 Loader、Registry、Context、Fiber 和 Effect 管理插件的加载、依赖、作用域、运行状态与资源清理。这样，同一套运行底座可以按场景组装出 Web、Headless 或其他 Agent 形态，具体能力也可以独立增加、禁用或替换。

第二个是 **append-only Session Event Log**。DSH 将用户消息、模型输出、工具调用、工具结果和其他运行事实记录为只能追加的类型化事件，不原地修改已经发生的历史。这份日志不是额外保存的审计副本，而是会话的唯一事实来源；LLM 消息历史、Trajectory、恢复、Fork 和 Replay 都由同一事件流派生。DSH 还要求“模型可见即已记录”，即进入模型请求并影响决策的内容必须能够从日志重建。

这两个理念解决的是不同问题：Cordis 插件化让系统组件能够被组合和演进，append-only 日志让组件不断变化时，会话历史仍然保持一致、可追踪和可重建。结合起来看，DSH 更像一套开放的 Agent Runtime，而不只是一个固定工作流的 Agent 产品。

---

#### 9.4.3 你如何看待 DSH 的爆火？

> **点评**
> 
> 这个题就是面试官考察你对行业的思考了，虽然不是硬技能，但是也是面试官偶尔会问的问题。考察的逻辑是，只有你是对行业有思考，有理解的，你才可能有自己对产品的理解，运用行业知识到自己的产品上，做出创新，特别是创业公司，小一点的公司，特别喜欢问这样的问题。

**参考答案**

我认为 DSH 的爆火既有 DeepSeek 品牌和发布时间带来的关注，也有开源策略、产品形态和技术方向共同作用的原因。

第一，DeepSeek 已经通过开源模型积累了很高的开发者关注度，DSH 又与其新模型同期发布，因此天然拥有较强的首发传播效应。但品牌只能解释初始流量，项目能够持续引发讨论，还在于它提供了比较明确的技术差异。

第二，DSH 采用 MIT 许可证，开发者可以查看源码、修改实现、开发插件并基于它构建自己的产品。它还提供一条命令即可启动的本地 Web UI，相比主要面向终端用户的 Harness，体验门槛更低。这里的“免费”主要指 Harness 本身，模型 API、运行设备和第三方服务仍可能产生费用。

第三，**Everything is a Plugin** 是一个非常清晰的传播点，而且有 Cordis 架构和源码实现支撑。DSH 不只是让用户添加几个工具，而是把模型、工具、Session、存储、Sandbox、调度、UI，甚至 Agent Loop 都放进插件体系。这使开发者能够想象围绕模型接入、企业工具、自定义工作流和 Agent Runtime 形成插件生态。

第四，它回应了开发者对开放 Harness 的需求。Claude Code、Codex 等产品已经提供了成熟体验，但很多核心编排和运行机制仍由厂商决定；DSH 则公开了完整 Harness，并强调模型与运行组件的可替换性，因此不仅吸引普通使用者，也吸引希望研究、定制或自建 Agent Runtime 的开发者。

从行业背景看，Agent 竞争正在从单纯比较模型能力，扩展到比较 Harness 如何管理上下文、工具、会话、权限、执行环境和验证流程。同一个模型放在不同 Harness 中，实际任务表现可能不同。DSH 在这个时间点开源一套完整、可重新组合的 Agent Harness，正好踩中了行业从“关注模型”转向“关注模型外部执行系统”的趋势。

不过，我不会把 GitHub 热度直接等同于产品成熟度或生产采用率。DSH 目前仍处于 Developer Preview，接口和数据格式可能发生破坏性变化，本地执行的安全边界、社区插件的供应链风险以及真实任务效果都需要继续验证。因此，我认为它当前最大的价值，是提供了一套值得研究的开放 Harness 架构，并推动行业重新关注 Harness 层，而不是已经证明自己全面取代了 Claude Code 或 Codex。

---

#### 9.4.4 你实际使用过 DSH 吗？使用体验如何？

> **点评**
> 
> 这个题没有标准答案，面试官就是想看看你是不是真的用过了，比如有些面试官喜欢那些对技术有追求的人，他们通常对这种行业的技术，一定会切身体验。所以面试官喜欢考察你是不是真的对技术有追求。答题思路就是要不你就真的用过，聊聊自己的感受，要么就找一个网上的测评，然后沉淀成自己的答案。下面这个答案就是根据网上测评结果，用AI生成了一版。

**参考答案**

我对 DSH 做过基础体验。整体感受是：它的架构理念和可观测性很有吸引力，Web UI 也降低了使用门槛，但产品仍然处于比较早期的阶段。

在使用流程上，DSH 可以在本地启动 Web UI。首次进入后配置模型 Provider 和 API Key，再选择 Workspace、模型和 Agent Preset。它并不只支持 DeepSeek，也可以接入其他 Provider 和本地 Ollama 模型。Web 形态比纯终端工具更直观，Session、Workspace、模型和 Preset 都可以在界面中管理。

基础 Agent 能力比较完整。给出一个应用开发任务后，它能够读取目录、调用 Bash、创建和修改文件，并根据工具结果继续执行。对我来说最直观的亮点是 **Trajectory**：它可以展示系统提示词、用户上下文、模型显式输出、工具调用参数、执行结果、耗时和轮次，还可以导出 Session JSONL。相比只看到最终答案，这种可观测性更方便定位 Agent 为什么成功或从哪一步开始出错。不过，Trajectory 展示的是被记录的模型输入、显式输出和执行轨迹，不等于公开模型未输出的全部内部思维。

另一个明显特点是插件化。可以通过 Profile 和 `cordis.patch.yml` 启用、禁用或替换部分能力；Creator Mode 还能够根据自然语言需求生成插件，在用户批准后动态挂载到当前运行环境。这说明 DSH 的插件化不只是增加普通工具，连 UI 和运行时能力也可以参与组合。

不足也比较明显。当前插件管理仍然偏开发者，部分操作需要理解配置文件；Creator Mode 生成的 UI 插件可能存在样式和交互问题。项目仍处于 Developer Preview，稳定性、兼容性和交互细节暂时不能与成熟产品直接相比。另外，DSH 会接触本地文件、Shell 和凭据，实际使用时需要控制 Workspace、权限和 Sandbox，不能默认本地运行就一定安全。

所以我的评价是：DSH 目前最值得体验的是 Cordis 插件化、Trajectory 和可重新组合的运行时，而不是把它简单理解为一个已经能够全面替代 Claude Code 的成熟产品。现阶段它更适合技术研究、插件实验和自定义 Agent Runtime；如果用于重要项目，还需要谨慎评估稳定性和安全边界。

---

#### 9.4.5 你如何看待 DSH 的发布？它与传统 Harness 有什么不同，又给行业带来了哪些启发？

> **点评**
> 
> 其实就是上面的题目的总和，他和传统Harness的不同，这个就答我们刚才那两点：插件和log的append-only特性。 带来了什么启发，就可以谈上面的行业思考能力。

**答题思路：先讲差异，再讲行业启发，最后保持冷静评价**

这道题可以分成三个层次回答。第一，使用 Cordis 插件化和 append-only Session Event Log 概括 DSH 与传统 Harness 的主要差异；第二，从开放生态、Harness 层价值和行业竞争迁移三个方面说明它带来的启发；第三，补充 Developer Preview 阶段的局限，避免把架构价值直接等同于产品成熟度。

**参考答案**

我认为 DSH 的发布值得关注，因为它公开的不只是一个可以直接运行的 Agent 产品，还包括一套完整、可重新组合的 Agent Harness 架构。

与很多传统 Harness 相比，DSH 最明显的不同首先是 **Everything is a Plugin**。传统产品通常拥有一个相对固定的核心，然后允许开发者增加工具、MCP 或 Skill；DSH 则把模型适配器、工具系统、Session、存储、权限、Sandbox、子 Agent、Agent Loop，甚至 Web UI 都放入 Cordis 插件体系。Profile 和配置决定系统使用哪些插件，Cordis 负责插件的依赖、作用域、生命周期、卸载清理和运行时重组。因此，开发者不仅可以给 Agent 增加功能，也可以重新组合 Agent 本身。

第二个不同是 **append-only Session Event Log**。DSH 不把日志仅作为旁路审计记录，而是把只能追加的类型化事件设为会话的唯一事实来源。模型消息历史、Trajectory、恢复、Fork 和 Replay 都从同一事件流派生，并且遵守“模型可见即已记录”的原则。它强调的不只是能够回放，而是模型当时看到的内容和执行过程必须能够从日志重建。

对行业的第一个启发是，Agent 的竞争正在从单纯比较模型能力，扩展到 Harness 如何管理上下文、工具、权限、执行环境、会话和验证流程。同一个模型放在不同 Harness 中，任务成功率、成本和可靠性都可能不同，因此 Harness 不再只是模型外面的一层薄包装，而是在逐渐成为独立的产品和工程竞争层。

第二个启发是开放和组合可能成为 Harness 生态的重要方向。DSH 使用 MIT 许可证，并把模型、工具、存储、Loop 和 UI 都设计成可扩展组件，这为模型 Provider、企业内部工具、工作流、存储后端和界面插件提供了共同的扩展基础。如果生态能够形成，团队可以保留自己的 Harness 与业务能力，只替换变化更快的模型或局部组件，而不必随着每次技术迭代整体迁移产品。

第三个启发是，可观测性和可审计性会成为生产级 Agent 的基础能力。Agent 的行为具有不确定性，仅保存最终答案不足以解释失败。系统需要回答模型看到了什么、上下文来自哪里、调用了什么工具、权限为何被允许，以及错误从哪一步开始。DSH 的事件日志和 Trajectory 对这一方向提供了较完整的工程示例。

不过，我不会因为 DSH 的架构新颖和社区热度，就认为它已经全面优于 Claude Code 或 Codex。它仍处于 Developer Preview，兼容性、默认安全边界、社区插件供应链以及真实任务表现都需要继续验证。因此，我认为 DSH 当前最重要的意义，是把开放、可组合、可追踪的 Harness 架构推到了行业讨论中心，并为其他 Agent 系统提供了值得借鉴的工程思路。

18.5 讲解视频

https://www.bilibili.com/video/BV1ee8A6rEpp/?spm_id_from=333.1387.homepage.video_card.click&vd_source=144bec9c3f54e465073138bed788be1b

---
