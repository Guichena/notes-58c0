# 源码维护指南

当前版本：2026-10-17，795 条目、1,740 复习单元、214 章节。先运行 `npm run build`，再运行 `npm run serve` 预览。发布步骤及验证边界见[仓库说明](../README.md)。

## 日后加题：改维护文件，不改大 HTML

先查重并确认目标条目 ID；例如，给已有 Agent 问答小节准备一道新题：

```powershell
node scripts/content.mjs new-question --entry ai-agent-9 --id q-new-detail --dry-run
```

确认目标和输出后，去掉 `--dry-run` 执行一次。编辑生成的 `authoring/questions/ai-agent-9--q-new-detail.json`，填好题目、简答、详细解释、追问和关联；核对来源后把 `draft:true` 改为 `draft:false`。理论题不填实现代码。检查现有题目顺序，使用高于当前最大值的 `order`，不要重排旧题。

四个入口均已存在：

- `new-entry`：新增问答小节或知识文档。
- `new-question`：向已有 QA 小节追加独立问题。
- `new-answer-addition`：给指定问题追加解释，不新增独立复习题。
- `new-supplement`：给原始非 QA 条目追加说明。

完整字段、稳定 ID、图片、关联、草稿启用、导入和撤回步骤见 [本地维护指南](authoring/README.md)。`--dry-run` 不写文件，也不证明启用后构建能通过。CLI 不覆盖同名文件。

## 修改后的验证

先在完整项目副本中操作。Windows PowerShell：

```powershell
$env:NODE_OPTIONS="--max-old-space-size=768"
npm run validate
npm run build
npm test
npm run serve
```

每一步成功后再继续；发生错误时不要把现有 `dist/` 当成新结果。

- `validate`：检查原始身份和 authoring 编译，不运行完整修订/显示投影链，不能替代构建和测试。
- `build`：从维护源文件生成真实 `dist/`，应用完整投影链。
- `test`：重新构建真实站点，检查重复构建一致性，并运行完整回归测试。兼容基线在隔离的 `.compat-dist` 中生成，不覆盖真实站点。
- `budget`：`npm run budget` 根据当前生成文件刷新资源体积报告。
- 不使用 npm 时，可直接运行 `node scripts/content.mjs validate`、`node scripts/build.mjs`、`node scripts/test-question-bank.mjs`、`node scripts/serve.mjs`。

测试默认并行数为 1；上述 Node 堆上限不是整机内存保证。自动测试不能替代页面与交互检查：新增后应检查正文、搜索、侧栏、问答模式、上一条/下一条、旧题和新题链接，以及隔离浏览器环境中的进度保存与重载。不要清空或覆盖原来的学习进度。

## 文件与兼容约束

| 位置 | 用途 |
| --- | --- |
| `src/` | 页面外壳、样式、按需加载、应用逻辑和图解 |
| `content/chapters/` | 63 个原始章节的来源层，不随意改写 |
| `content/metadata.json`、`content/legacy-identities.json` | 原始目录、别名、重点地图和身份保护 |
| `content/` 其他注册表 | 经审核的有限修订、显示投影及学习顺序 |
| `authoring/` | 新条目、新题及内容追加的主要维护入口 |
| `examples/authoring/` | 不自动进入网站的字段示例 |
| `public/` | 保留资源和已核对的本地图片 |
| `scripts/`、`tests/` | 无依赖 CLI、构建、测试与本地 HTTP 服务 |
| `baseline/` | 完整原始快照与校验清单，只读参考 |
| `dist/` | 生成的网站，不直接编辑 |

63 个原始章节与当前 214 个生成章节不是同一统计。归档、原始基线、可见学习视图、`validate` 的投影前统计也不能混用。

- 保留原始 524 条目、934 个复习标识；原始 97 个 QA 小节中的 507 道题保持题目身份和零基索引。兼容套件包含 1,780 个路由案例，这些是历史兼容范围，不是最终测试通过数。
- 原进度键继续使用 `条目ID#题目索引` 或 `progressKey || id`，包括 58 个保留旧键的算法拆分条目；新增题使用 `条目ID#q-稳定ID`。保留 `iv8-progress` 结构及旧 v7 迁移路径。
- 保留模块/条目/题号路由、旧 `#id`、算法别名、旧面经父条目及 `#/must/` 到 `#/hl/` 的跳转。资源兼容 `/notes-58c0/` 前缀，不表示已经发布。
- 七个模块仍为 `algo / code / design / bagu / ai / syntax / plan`。模块内按学习重点展示，侧栏、卡片和前后遍历保持同一顺序。新增条目、分类、分区稳定追加；普通新增无需改学习排序 rank 注册表。
- 已发布 QA 只追加，不能删题、插入或重排旧题。显示名称和顺序调整不改变身份、旧索引与进度键。
- 本地与线上站点，以及 `localhost` 与 `127.0.0.1`，属于不同 origin，浏览器不会自动搬移学习进度。

现有正文可能来自修订/显示投影。修改前先定位生成层；遇到 stale input 或完整性报错，停止合入，核对原稿、目标和投影顺序，明确审阅后再衔接保护。不要只换哈希、删除保护文件或从新输出盲目重录基线。`baseline/index.html` 只用于原稿核对，不是日常维护入口。

## 加载与资源

首屏加载目录、应用逻辑和样式；正文按章节读取，详情图解按需加载。首次输入非空全局搜索词才请求纯文本搜索索引，不会先下载全部正文章节。同一资源请求去重，成功结果在页面会话内缓存；失败可重试，旧响应不覆盖新路由或搜索。

应用和图解采用限定的 classic-script 共享作用域；加载层使用原生 ES modules，没有框架或打包依赖。正常构建追加正文长文本换行样式，代码卡保留内部横向滚动，不改兼容基线样式。

实际体积以当前构建的 `dist/build-manifest.json` 为准。没有 Service Worker 或持久离线缓存，断网或刷新后不保证可用。

