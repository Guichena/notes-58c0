# Backend-06 independent source receipts

The author primary audit is preserved unchanged under input/primary-source-audit.json (23 URLs and bounded scopes). Independent browser retrieval on 2026-10-15 checked these high-risk claims:

- https://www.rabbitmq.com/docs/quorum-queues : displayed Version 4.3; lines 203–212 strict 0–31 priority, 352–450 delayed retry, 458–490 failed-versus-acquired counts and nack/reject distinction, 473–476 default limit 20 from 4.0. Confirms version-scoped passages without importing newer initial-delay APIs. At-least-once dead-letter prerequisites separately listed at lines 168–181.
- https://github.com/rabbitmq/rabbitmq-delayed-message-exchange : fetched official repository; author audit's historical-plugin scope retained, not promoted to an installed/runtime claim.
- https://rocketmq.apache.org/docs/featureBehavior/04transactionmessage/ : fetched official transaction-message model; persisted check result and bounded unresolved-message lifetime remain essential. The new timeout qualification is compatible with the rest of the answer; no claim of global ACID accepted.

Other claims were compared against the author's explicit versioned primary-source receipts, not an assumed executed broker. No deployment, throughput or personal ownership claim is certified.

Renderer inspected directly: site/notes-58c0-refactor/dist/assets/app.js lines 607–611 only remove an exact authored lead prefix when leadType is authored. v9 leads are rendered separately with unsuppressed answer content. No new matching prefix found in this batch.

See audited-input-hashes.json for exact author snapshot identities and mechanical-checks.json for exact per-leaf approval hashes. Current compiled catalog has 243 entries; catalog entry IDs, not the old question-count metadata, define valid link targets.
