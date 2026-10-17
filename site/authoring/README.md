# 本地笔记维护指南

新增和补充知识主要维护 `authoring/`，构建程序负责目录、章节、搜索和问答展示。四个子目录都已有正式内容，不是空模板目录。网站当前展示是原始层、新增层和经审核的修订/显示投影共同生成的结果；不能只看某一份源 JSON 就判断最终页面内容。

## 先记住这几条

- 保留原始 ZIP、备份和原始来源文件，不覆盖原稿。先在完整的临时项目副本中试改，再将审核通过的精确文件清单合入本地工作项目。本流程不推送、不发布。
- 新主题可扩展后端、Agent 等现有方向；不新增前端、推荐系统内容。模块仍为 `algo / code / design / bagu / ai / syntax / plan`，用已有模块里的分区和分类组织新专题。
- 理论问答、AI/Agent 和场景题只写解释、原理、边界、取舍与追问，不放代码、伪代码或配置片段。新增实现代码只用于算法、真正需要实现的手写题和 SQL 练习。原有独立的 44 条 Java 语法速查仍保留刷题与手撕用的编码示例，作为编程辅助，不混入八股、AI 或场景问答。CLI 支持 `code` 不代表所有主题都应使用它；不要把代码藏进普通文本或 HTML 绕过此规则。
- ID、旧题索引、链接和进度键保持稳定；发布后的 QA 数组只追加，不插入、删除或重排旧题。新增知识优先归入已有规范条目，避免换个说法重复收录。
- 不编辑 `dist/`。它是生成结果，下一次构建会覆盖。也不要用更改哈希、删除保护文件或重录基线来消除报错。

## 1. 选对新增入口

- 新增一个问答小节或知识文档：`new-entry` → `authoring/entries/`。
- 给已有 QA 小节增加一道独立问题：`new-question` → `authoring/questions/`。
- 给一题补充经过核对的增量解释：`new-answer-addition` → `authoring/answer-additions/`。
- 给原始非 QA 条目补充说明：`new-supplement` → `authoring/supplements/`。

先从当前网站的 `#/e/条目ID` 链接及对应源文件确认目标。`dist/data/catalog.json` 可用于查找当前可见条目，但只读；原始目标还需核对 `content/chapters/`，新增目标查 `authoring/entries/` 或 `authoring/questions/`。有些历史条目被显示策略归档，源文件存在不保证当前页面可见。

以下命令均在项目根目录执行，即含 `package.json`、`scripts/`、`content/` 的目录。要求 Node.js 20 或以上，无需安装 npm 依赖。示例中的目标 ID 是已有条目；正式使用前必须确认适合自己的内容，并改用新的唯一 ID。

### 新建问答小节或知识文档

```sh
node scripts/content.mjs new-entry --id backend-new-topic --kind qa --module bagu --part "后端" --category "新增专题" --title "新问答小节" --dry-run
node scripts/content.mjs new-entry --id agent-new-note --kind doc --module ai --part "Agent" --category "工程实践" --title "新知识点" --dry-run
```

确认输出后，去掉 `--dry-run` 执行一次：

- `qa` 草稿带一道占位问题，存于 `questions` 数组；填完整后使用，也可通过 `new-question` 增补。
- `doc` 草稿按 `sections` 分节，每节有稳定 `id`、`title`、`body` 和可选 `code`。
- 条目 ID 全站唯一，只用小写英文、数字、连字符，并以字母开头。不要为改标题而换 ID。
- 同一模块可增加分区 `part` 和分类 `category`，不需要新增顶栏按钮。

### 给已有 QA 小节新增一题

```sh
node scripts/content.mjs new-question --entry ai-agent-9 --id q-new-detail --dry-run
```

确认后去掉 `--dry-run`。生成文件为 `authoring/questions/ai-agent-9--q-new-detail.json`。题目 ID 以 `q-` 开头，同一小节内唯一。省略 `--id` 会生成 UUID；一旦正式创建便保持不变。不要依赖两次 dry-run 生成相同 UUID。

下面是无代码理论题的完整文件示例；它用于说明字段，是否真正新增仍需先查重：

```json
{
  "schemaVersion": 1,
  "draft": false,
  "entryId": "ai-agent-9",
  "id": "q-new-detail",
  "order": 1000,
  "question": "为什么 Agent 的工具调用需要幂等设计？",
  "commonPhrasings": ["重试如何避免重复副作用？"],
  "shortAnswer": "重试可能重复执行外部操作，因此需要识别同一业务意图并复用已确认的结果。",
  "explanation": {
    "format": "text",
    "value": "先说明哪些操作会产生副作用，再说明幂等键的作用域、结果记录与失败恢复。\n\n幂等不能替代授权、并发控制和对外部系统实际状态的核对。"
  },
  "followUps": ["超时后如何区分操作失败与结果未知？"],
  "code": [],
  "tags": ["Agent", "可靠性"],
  "related": [],
  "mustKnow": false
}
```

`order:1000` 只是示例，不保证排在现有题目末尾。正式新增时检查该条目的所有启用新增题，选用高于当前最大值的 `order`，保证旧数组是新数组的原样前缀。

### 给原题追加解释

```sh
node scripts/content.mjs new-answer-addition --entry ai-agent-9 --question 0 --id add-new-detail --dry-run
```

`--question 0` 指原题的零基索引，不是屏幕上从 1 开始的题号。核对题目文字后才继续。去掉 `--dry-run` 创建草稿，填写标题及正文。追加文件保留原题身份，不新增独立复习题。

若目标是已经启用的新增题，必须显式指定 authored 模式和稳定题目 ID：

```sh
node scripts/content.mjs new-answer-addition --entry ai-agent-9 --question q-ai-agent-trajectory-contract --target-origin authored --id add-trajectory-detail --dry-run
```

该模式支持 `authoring/entries/` 内的问题，以及 `authoring/questions/` 中追加的问题；不接受数字索引、草稿或缺失目标。未指定 `--target-origin` 时默认是原题模式，也可显式写 `original`。

### 给原非 QA 条目补充说明

```sh
node scripts/content.mjs new-supplement --entry doc-16 --id add-note-detail --dry-run
```

支持原始 `doc / ptopic / algo / pattern / database / handwrite / scenario / syntax`，补充显示在正文后、上一条/下一条导航前，不新增复习单元。它不支持 authored 目标；新增 doc 的维护应检查其源文件和相关保护，再按下文流程修改，不能用 `new-supplement` 绕过。

两类追加记录共用 `add-…` 唯一 ID、`entryId`、`expectedOriginalHash`、`title`、`body`、可选 `code`/`related`；答案追加还需要字符串 `questionId`。CLI 自动生成目标哈希：

- 原题模式锁定原题整个对象；原非 QA 补充锁定原条目整个对象。
- authored 模式锁定启用的新增内容完成基础编译、标签和关联已加入、任何追加尚未应用时的整题快照。
- 多条追加各自针对同一个未追加目标，不哈希前一条追加的结果。重复构建不会累积重复正文。
- 哈希不匹配时停下来检查目标和来源，不要手工改成当前哈希就继续。增加一条补充也可能触及后续投影保护，必须完整构建和测试。

## 2. 填好草稿再启用

所有创建命令默认生成 `draft:true`。完整填写、核对来源和去重后，明确改成 `draft:false` 才纳入编译。嵌套问题若有自己的 `draft:true`，也要单独处理。草稿不是免检区：结构、图片以及扩展目标/哈希等仍会被检查；不要把残缺占位文件留在正式批次里。

启用的内容不能引用仍是草稿的目标。`new-question` 可以为草稿 QA 创建文件，但该题启用前，所属 QA 条目也必须启用。

`related` 用于链接规范知识，避免复制正文：

```json
{"entryId":"ai-agent-9","questionId":"q-ai-agent-trajectory-contract","label":"参见完整解释"}
```

旧题 `questionId` 使用字符串数字，如 `"0"`；新增题用 `q-…`。可省略 `questionId` 只关联条目。构建会核对引用存在性，是否仍可在当前学习视图访问还应做浏览器检查。

## 3. 正文格式和本地图片

普通正文优先用 `{"format":"text","value":"完整解释。\n\n第二段。"}`，空行分段。题目、简答、标题、标签等按普通文本转义。

需要段落、列表、表格、图片交错时，可用 `blocks`：

```json
"blocks": [
  {"type":"paragraph","text":"先说明问题和适用边界。"},
  {"type":"heading","level":3,"text":"方案比较"},
  {"type":"table","headers":["方案","取舍"],"rows":[["重试","需要防止重复副作用"],["人工确认","增加处理时间"]]},
  {"type":"list","ordered":false,"items":["明确失败状态","记录恢复步骤"]},
  {"type":"image","src":"assets/imported/agent/reviewed-flow.png","alt":"已核对的处理流程图"}
]
```

图片是格式示例，必须先放入实际文件才能使用。

- 题目的 `blocks` 替代 `explanation` 和 `code`；doc 小节或追加记录的 `blocks` 替代 `body` 和 `code`。互斥字段必须删除，不能留空数组。
- 支持 paragraph、heading、list、table、image，以及仅用于允许的实现练习的 code。未知类型/字段拒绝；blocks 不支持原始 HTML。
- heading.level 仅限 2、3、4；list.items 非空且 ordered 为布尔值；表格各行列数须与表头一致，单元格为字符串。
- 图片仅接受 `assets/imported/` 下的本地 png/jpg/jpeg/webp/gif/avif，文件实际存放于 `public/assets/imported/`。必须有非空 alt；不接受远程 URL、SVG、data URL、路径穿越或符号链接。草稿也检查图片存在性。
- 只有实际算法、手写或 SQL 练习需要代码卡时才使用 code：language/value 必填，label 可选。理论/AI/场景内容不使用此类型。
- 原有新题 explanation 和 doc body 仍支持显式 `format:"html"` 的可信富文本，但维护时优先用 text/blocks。答案追加和 supplements 不接受 raw HTML；不要直接粘贴外部 HTML，也不要添加未知的来源、配置或密钥字段。

## 4. 稳定身份与学习顺序

原始 QA 的题目文字、数组位置和数字链接是兼容契约，不修改、不删题、不插题、不重排。新题用 `条目ID#q-稳定ID` 记录进度，链接为 `#/e/条目ID/q-稳定ID`。稳定 ID 不能用来掩盖题目换义。

基础编译把新增题接在原题之后，并按 `order`、再按 ID 排序。即便稳定题目链接能承受排序变化，也不要重排已发布的 QA：已有数字锚点和受保护的题目索引仍需保持。新题选择追加顺序，发布后不重新编号或批量调整 order。

学习展示排序与源身份分开维护。采用已审核的学习顺序配置后，新增条目稳定追加到所属分类末尾，新分类追加到分区末尾，新分区追加到模块末尾；不需要为日常新增修改 `content/interview-learning-order.json` 的 rank 列表。新增项可能产生编辑者提示，这不等于构建失败。不要为消除提示而随手改排序注册表。

如果要调整既有分类/分区的成员、拆分合并分组、跨模块移动，或改变已审核学习顺序，应单独审阅。显示名称可与身份分开，但也要检查其他有限投影是否保护该字段。

## 5. 修改既有正文：先检查保护，再审阅变更

本项目不是“编辑任意源字段后重建即可”。构建包含多层有限、经审核的修订和显示投影，可能锁定字段、整题、条目、来源文件、运行时代码或注册表哈希。某些页面文字来自投影而非源文件原值。

普通新增优先走上面的 authoring 入口。若需要修改现有答案、标题、代码、标签、关联或补充，先定位最终字段由哪一层生成，以及是否影响已有追加的目标哈希或后续保护。即使只是追加到某个已有答案，也可能改变被保护的完整字段。

碰到 stale input、source/registry integrity mismatch、目标题目/身份变动等报错时：

1. 停止合入，保留报错与原有备份；核对真实目标、原稿及修改意图。
2. 明确列出受影响的源字段、追加目标、投影顺序及预期页面差异。
3. 做一次显式、经过审核的 rebase：在副本中按正确构建顺序重新衔接相关修订与保护，独立检查旧身份、未涉及内容和新输出。
4. 仅在审阅通过后更新确实需要更新的保护数据及对应测试，并运行全套检查。不能只把报错哈希换成当前值，也不能从新 dist 盲目重录旧基线。

`content/legacy-identities.json`、兼容基线和身份测试不应为普通内容新增而修改。没有一条通用的“自动更新所有哈希”命令可以安全完成上述审阅。

## 6. 验证、构建、测试和预览

在临时完整项目副本中执行：

```sh
NODE_OPTIONS=--max-old-space-size=768 npm run validate
NODE_OPTIONS=--max-old-space-size=768 npm run build
NODE_OPTIONS=--max-old-space-size=768 npm test
npm run serve
```

打开 `http://localhost:4173/notes-58c0/`。另一个终端或浏览器检查后，用 Ctrl+C 停止预览。端口占用时可用 `PORT=4174 npm run serve` 并访问对应端口。服务只监听本机 127.0.0.1。

严格本地的直接 Node 等价命令：

```sh
node scripts/content.mjs validate
node scripts/build.mjs
node scripts/test.mjs
node scripts/serve.mjs
```

- validate 主要检查原始身份与 authoring 编译，不运行 build 的完整修订/显示投影链。因此校验通过不代表完整构建通过，输出条目数也不必等于最终可见条目数。
- build 生成真实 dist 并应用完整投影链；失败后不要依赖现有 dist，它可能是旧结果或未完成结果。修好后重新完整构建。
- test 会重新构建真实站点并检查产物，再为兼容测试建立隔离的 `.compat-dist`，结束后清理；不会用兼容构建覆盖真实 dist。不要把测试专用 `--baseline-test` 当正常发布入口。
- 当前测试 runner 默认并行数为 1，常规验证以 `NODE_OPTIONS=--max-old-space-size=768` 控制单个 Node 进程堆上限；该设置不是整机内存预算或此前 SIGKILL 根因证明，不减少断言。
- `src/style-overrides/prose-wrap.css` 只附加到正常构建，不进入 `--baseline-test` 兼容构建。它为正文长 token 换行，保留代码块滚动；不要直接改基线样式来掩盖页面缺陷。
- 真实进度往返和清理应使用隔离 origin，不读取、复制、覆盖或清空用户原预览 origin 的状态；窄桌面窗口验收不能写成真机移动端验收。
- 首次新增后检查页面正文、侧栏/卡片、搜索、问答模式、上一条/下一条、旧题及新题链接、进度保存和重载。自动测试不代替视觉和实际交互检查。
- 改完再测试；不要把修改前的通过结果当本次验收。全部通过且审阅完成后，才按精确文件清单合入本地工作项目，并再次构建/测试。不执行 git push 或部署。

`--dry-run` 只打印路径与草稿，不写文件，也不证明启用后的完整构建可通过。创建命令不覆盖同名文件；试验可用 `--root /绝对路径/完整临时项目副本`，但 build/test/serve 应在该副本根目录执行。

## 7. 小批次导入、来源记录和撤回

每批只处理一个主题：先核对来源与现有覆盖，保留新的必要增量。来源审计写在项目外的批次 manifest，不往正文 JSON 添加不支持的字段。

1. manifest 记录批次、真实文档 URL/ID、标题、获取时间、源章节/块 ID、源摘要哈希、目标 entry/question、authoring 相对路径及文件 SHA-256。本地图片也记录路径、来源和哈希。
2. 导出仅携带精确清单里的 authoring JSON 和图片，保留相对路径；不带 dist、全量原始章节、基线、浏览器进度或凭据。跨主题 related 的目标必须已有，或列为明确依赖。
3. 导入完整临时项目副本。遇到同名文件或 ID 内容不同则停下来审阅，不覆盖；完全相同的已有文件跳过。执行 validate、build、test 和浏览器检查。
4. 检查点记录完成的源块、文件及哈希、测试结果、未处理项和下一步即可。原始来源和备份继续保留。
5. 撤回只涉及本批新增文件时，可移出这些文件后重建；先处理后续引用，并检查是否已有投影/保护依赖它们。已发布题目不能以“撤回批次”为由直接删除而破坏稳定链接或索引，须单独审阅迁移方案。

目前是本地 JSON + CLI 工作流，没有可视化 CMS、自动抓取、自动发布或离线同步。
