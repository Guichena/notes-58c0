# Scenario04 independent source and scope receipts

Reviewed 2026-10-15. The author’s sixteen primary-source receipts are preserved unchanged in input/primary-source-audit.json. Independent checks reopened:

- https://redis.io/docs/latest/commands/wait/ — WAIT confirms replication, not strong consistency or universal loss prevention. Supports retaining explicit failover boundaries.
- https://go.dev/doc/go1.23 — Go1.23 timer changes allow collection of unreachable unstopped timers/tickers; not a guarantee that a live goroutine exits.
- https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html — core worker / queue / maximum worker admission order; probabilistic growth is a hypothetical custom strategy, not the default executor.
- https://www.rfc-editor.org/rfc/rfc6455.html — protocol handshake, Origin, masking and Ping/Pong do not establish application-level delivery or user identity.

The numerical and workload corrections in additional-composition.json are dimensional analysis and explicit hypothetical capacity reasoning, not product benchmarks. In particular QPS alone does not dictate a cache, Kafka, sharding, regional distribution or asynchronous business semantics. Streaming can deliver partial output sooner than buffering the whole answer; transport selection alone does not reduce model-internal time to first token.

All 50 author changed leaves were reread in full, together with all twelve entries’ short surfaces, pattern siblings and unchanged supplements. The audit adds two original-guard sibling leaves (RAG architectureEvolution and interviewPitch). It restores three inline code wrappers in doc-23 that the author’s prose repair had removed; command names and complete code/pre artifacts now mechanically match original values. 38 exact composition operations are recorded. Numeric-token retention is checked against every author candidate; original before values and the 2144-span author map remain immutable provenance. This is not a claim that all original false numerical assertions survived unchanged: the author’s explicit corrected examples and original provenance are retained.

The frozen original images are references, not measured project evidence. No performance experiment, runtime compilation or browser rendering was executed in this independent audit. Parent integration must still revalidate final rendered content and links/fragments after composing overlapping batches.
