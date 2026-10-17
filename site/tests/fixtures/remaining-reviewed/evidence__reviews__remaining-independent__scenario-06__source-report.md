# Independent source and scope report

Opened primary sources 2026-10-15:
- https://developers.cloudflare.com/queues/reference/delivery-guarantees/ : at-least-once and application deduplication.
- https://developers.cloudflare.com/queues/reference/how-queues-works/ : ordering is not promised; batch/individual acknowledgment and nonblocking send caveats.
- https://developers.cloudflare.com/kv/concepts/how-kv-works/ : local immediate visibility is not guaranteed, remote cache visibility can exceed 60 seconds, negative lookups cache, serializing writes does not strengthen KV reads.
- https://www.postgresql.org/docs/current/rangetypes.html : range overlap and exclusion constraints, including room-style constraints. This is an alternative to the retained MySQL stable-resource-row locking protocol.
- https://resilience4j.readme.io/docs/circuitbreaker : state machine, minimum samples and bounded half-open calls. Rejection and safe fallback are separate choices.
- https://www.rfc-editor.org/rfc/rfc2104.html : keyed message authentication differs from an unauthenticated digest.

The other receipts in input/primary-source-audit.json are inherited author evidence, not claimed fresh fetches. Historical Mafka2018/2019, Nacos2.4, Seata2.6, etcd3.5/3.6 and Java21 descriptions remain scoped. H2 2.5.252 in the authored distributed notes is a distinct teaching dependency from H2 2.3.232 examples in scenario-05, not silently unified. No Java, SQL, Cloudflare or cluster test was executed here. The original 16370 assertion statement remains explicitly an unverified original report. The NoteWeave description remains unverified source-described teaching material, not personal experience or verified deployment safety.

Read all 12 staged entries and 45 questions, including long answers, leads, summaries, dimensions, and supplementary notes. Eight narrow composition changes fix residual short-surface mismatches and protocol details: breaker failure OR safe fallback, optional hotspot/leaderboard choices, current reads after resource locking, renderer config/identity checks in source-version publication CAS, UNKNOWN task counts versus completion, and late advertisement confirmation at the first summary boundary. Interval, fixed-slot and reschedule variants remain separate; new conflict preserves the old booking. Token rate, concurrent in-flight and financial budget units stay separate. The authenticated digest explanation and late-ad/rolling-window examples are retained.

All original guards and frozen file hashes verified. All1710 original HTML spans traced in order into composed leaves; all author-candidate numeric tokens retained, including 100000 external tasks,15/30-minute slots,100ms like visibility,125TB sparse-matrix contrast and10万人/1000 seats. Code blocks, anchors, hrefs, source fields and image metadata remain intact. Independent VM checks use actual compiled renderQA and question-anchor semantics for all45 cards; helper stubs mean this is not browser visual/integration acceptance. Local route targets independently checked against current catalog; remote source URLs/images are preserved, not asserted freshly available.

Apply only approved-leaves.json against its original entry/value guards. Root retains final assembled page/navigation/source-projection and full regression responsibility.
