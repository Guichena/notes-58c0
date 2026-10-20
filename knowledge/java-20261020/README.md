# Java 学习笔记 · 离线阅读版

打开 `index.html`，从并发或 JVM 路径进入正文。页面是静态知识文档，不是需要运行的应用，也不包含实验程序。正文、导航和样式不依赖网络；外部规范和参考资料链接需要联网。

## 文件结构

- `index.html`：问题导向的阅读目录。
- `java/concurrency/`：可见性、原子更新、锁、同步框架、任务与线程上下文。
- `java/jvm/`：内存、对象、类、执行、回收与诊断。
- `assets/reading.css`：本地蓝白阅读样式。
- `sources/`：完整 Markdown 正文，供阅读和重建。
- `documents.json`：标题、主题、阅读顺序与相对文件位置。
- `build.py`：文档转换脚本。
- `SHA256SUMS.txt`：本目录除校验清单自身之外的文件 SHA-256。

## 重建 HTML

仅修改或重建页面时需要 Python 3 和 Pandoc，阅读成品不需要安装任何工具。Pandoc 的官方安装说明：https://pandoc.org/installing.html 。本版使用 Pandoc 生成 HTML5；不同 Pandoc 版本的标记或标题锚点可能略有不同。

在当前目录执行：

```sh
python3 build.py
```

脚本只从 `sources/` 读取正文并生成 HTML、目录与校验清单，不执行正文示例，不启用服务器，不上传或发布文件。标题引用只在本知识集中存在对应文档时转为本地链接，未收录主题保持普通文字。

重建前可在支持 `sha256sum` 的系统中检查当前文件：

```sh
sha256sum -c SHA256SUMS.txt
```

重新生成校验清单只代表当前文件内容，不能代替对修改内容的审阅。搬移或部署时请保持整个目录结构；无需数据库、JavaScript、外部字体或远程样式。
