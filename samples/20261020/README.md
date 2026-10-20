# 三份独立学习样稿 · 2026-10-20

包含 HashMap、LRU 缓存、RAG 检索与评测的原创学习说明、离线阅读页、示例代码与测试记录。

## 阅读与复现

下载本目录后，用浏览器打开 `阅读版/index.html`。正文可离线阅读，外部参考链接需要网络。

- HashMap：进入 `hashmap`，运行 `java --add-opens java.base/java.util=ALL-UNNAMED HashMapProbe.java`。反射仅用于本地学习实验。
- LRU：进入 `lru`，运行 `bash run-tests.sh`。
- RAG：进入 `rag`，运行 `python3 verify_metrics.py`，只核验假设算例的算术，不运行真实检索或模型。
- HTML：进入 `阅读版`，运行 `python3 check_structure.py`。重新生成需要 Python 3 与 Pandoc 3，运行 `python3 render.py --build-all ..`。

## 边界

该目录仅为独立样稿，不修改原有 803 条学习基线，不代表网站发布。此批仅提交到 `recovery/samples-20261020` 分支，不修改 main、不创建合并请求、不合并、不部署。

记录中的测试结果来自样稿制作时的本地运行；静态 HTML 检查不等于浏览器视觉验收。未验证 LRU 的 TTL 或并发实现，也未验证真实 RAG 系统效果。

正文为原创归纳与示例，参考依据在文中链接；不包含飞书原文、私人笔记、原始导出或压缩备份。`SHA256.json` 记录本目录除清单自身外所有文件的 SHA-256。
