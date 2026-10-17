# Backend08 independent source receipts

Audit date: 2026-10-15. Author files were copied byte-for-byte into input before review. These are audit records, not claims that a runnable code bundle was supplied.

## Independently reopened primary sources

- Java SE 21 Thread API: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.html . Sections run, stop, suspend and resume: direct virtual-thread run does not execute its task; the platform task path is distinct. stop, suspend and resume throw UnsupportedOperationException in this version. This supports the existing author fix and the additional residual Q3/body-summary and suspend/resume corrections.
- muduo v2.0.2 EventLoop: https://raw.githubusercontent.com/chenshuo/muduo/v2.0.2/muduo/net/EventLoop.cc . Owner-thread assertions, event dispatch, runInLoop/queueInLoop and conditional wakeup inspected. EventLoop explicitly closes its wakeup descriptor, illustrating why a Channel must not automatically be equated with a TCP connection. This alone does not establish the complete header ownership declarations.
- muduo v2.0.2 TcpServer: https://raw.githubusercontent.com/chenshuo/muduo/v2.0.2/muduo/net/TcpServer.cc . newConnection selects the pool loop and schedules establishment there; destruction/removal dispatches connectDestroyed to the connection loop. Checked the exact tag, not a third-party rewrite.
- muduo v2.0.2 EventLoopThreadPool: https://raw.githubusercontent.com/chenshuo/muduo/v2.0.2/muduo/net/EventLoopThreadPool.cc . getNextLoop defaults to baseLoop and rotates through nonempty loops. This is connection routing, not business-worker budgeting.
- Redis 6.2 branch ae_epoll: https://raw.githubusercontent.com/redis/redis/6.2/src/ae_epoll.c . Both add and modify paths register EPOLLIN/EPOLLOUT without EPOLLET. This independently closes the author's 6.2 retrieval gap; it does not certify an exact patch release or all platforms. The author's 7.2 source remains inherited evidence.

## Exact-version source gap retained honestly

Both https://raw.githubusercontent.com/chenshuo/muduo/v2.0.2/muduo/net/Channel.h and https://raw.githubusercontent.com/chenshuo/muduo/v2.0.2/muduo/net/TcpConnection.h failed independently with cache-miss retrieval errors. GitHub blob URLs and refs/tags raw forms also failed. Search did not establish the exact-tag headers; third-party educational forks and current master were not substituted. The additional composition narrows the ownership paragraph to the distinction to check, retaining the Channel versus connection question without certifying uninspected member/deallocation declarations. Failure to retrieve v2.0.3 is not evidence that it never existed.

## Inherited author receipts and local evidence

The other primary-source URLs and scope statements are preserved in input/primary-source-audit.json. They are not represented as independently reopened by this pass. The NoteWeave c60decb1 source facts remain confined to the author's previously checked pom and narrow embedding/rerank call-site matrix; no deployment version, personal role, Python execution architecture, throughput or latency gain is inferred.

BoundedPool was reviewed as a protocol, not executed: registering after start can leave an unregistered live worker and double-decrement alive. The composed candidate distinguishes this failing order from register-before-start design and explicit shutdown/join testing. Deadlock material requires actual waiting stacks and a cycle, rather than timeout/nontermination alone. PECS preserves the same-T extends-source/super-target relation and now states the exact chosen append operation. No compiler, JVM, load test, networking experiment or production measurement was run.

## Retention and remaining integration work

45 original guarded leaves; 9 entries; 51 questions. All original before strings and hashes remain unchanged. All anchors, hrefs, images, pre/code regions, question IDs, wording and order remain unchanged. Two list-item bodies have explicit supplied-implementation claims reworded as model/validation conditions; their question variants and test boundaries remain intact. Section marker 38 is restored. The only removed numeric token is the unverified muduo 2.0.3 baseline, replaced by inspected v2.0.2 and recorded in the diff.

No absent-property leaves: every approved path already exists in the frozen entry. Catalog scan inspected all 768 selected entries and found no other entry combining muduo with 2.0.3. Full changed-leaf and sibling reading covered all 51 authored leads and question variants, including the standalone Java answers. This is not a final assembled render or a guarantee about remote Feishu anchors. Final integration/fragment/render acceptance remains with the root task.
