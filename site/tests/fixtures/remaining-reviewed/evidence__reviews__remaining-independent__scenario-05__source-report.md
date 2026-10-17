# Independent source and scope report

Opened primary sources on 2026-10-15:
- https://www.rfc-editor.org/rfc/rfc9562.html : UUID128 layout, version-specific time ordering and collision assumptions. Distinguishes unique identifiers from request idempotency.
- https://go.dev/doc/go1.23 : timer/ticker collection changes are gated by module Go version and compatibility setting. Composed leaf makes that gate explicit.
- https://www.rabbitmq.com/docs/reliability : producer/broker/consumer responsibility, confirmation and redelivery boundaries support preserving durable obligations and consumer deduplication.

Other primary receipts are inherited, not claimed as newly fetched: input/primary-source-audit.json. MySQL8.4.0, H2 2.3.232, JDK21 and RocketMQ4.x stay explicitly pinned teaching examples. No Java, database, message-broker or production performance result was produced by this audit. Existing assertion counts and source labels are retained with their surrounding scope disclaimers.

Full staged prose and supplements reviewed. Composed corrections reconcile residual generic templates: durable acceptance before MQ, UNKNOWN before release, finite admission, conservative local rate fallback, Snowflake uniqueness and clock handling, idempotency short summary, Go timer gate, rate versus simultaneous work, SQL/NoSQL model caveats and capacity-based scheduling. Distinct numbers and all author-candidate numeric tokens remain intact. The illustrative pool 500×0.04=20 is explicitly mean occupancy, not a pool sizing guarantee.

Mechanical verification independently checked the expected frozen author manifest and every listed file hash; all 18 exact scalar leaves have entry and before/after guards. All 2684 original HTML spans resolve exactly to original entry offsets. Structural IDs, hrefs, image markup, code blocks and unchanged scalar metadata remain. The original ordered span ledger and additional exact replacements jointly trace composition; no broad replacement file is approved for application.

Use approved-leaves.json only, against its original guards. Final assembled routes, image availability and browser layout remain root integration checks. Author renderer checks are retained as author evidence, not relabeled independent execution.
