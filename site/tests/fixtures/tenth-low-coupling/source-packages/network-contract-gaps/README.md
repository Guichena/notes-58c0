# CORS/SSE confirmed contract gaps: candidate only

Only two existing answers are proposed for change:

- `own-network-web#q-own-network-web-security`
- `own-network-web#q-own-network-sse`

`records.json` contains two exact `a` before/after replacements with SHA-256 guards. `leaves-before-after.json` additionally records both `lead` fields before/after/hash; both leads remain byte-for-byte unchanged because their existing core summaries remain correct. No no-op lead mutation is proposed. Original question wording, IDs, item indexes, metadata, HTML anchors, variants, tables and inline escapes remain unchanged. No new question or entry is proposed.

## What changes

CORS receives a short direct answer covering preflight / actual request / response visibility, credentials mode, exact allowed origin, authentication and CSRF boundaries. It links to the fully read existing Spring authentication canonical for headers, cache dimensions and filter-chain configuration rather than copying that entire answer.

SSE receives two bounded subsections: initial Servlet thread release versus potentially blocking writes, and native EventSource reconnect versus application replay. Direct application `SseEmitter.send` execution is explicitly distinguished from the configured executor used for reactive return types. `close()`, HTTP 204, final response failure, EOF, business terminal events, Last-Event-ID, ownership, replay windows and deduplication are addressed directly. The two existing canonical answers retain their detailed lifecycle and recovery ownership.

The public candidate does not introduce an implementation field name such as `reactiveTaskExecutor` as though it were a universal executor bean. The official 6.1.14 return-value-handler source confirms that the reactive path receives its executor separately, while the direct emitter's handler writes and flushes in its call path. Current 6.2 reference documentation is used for the general conceptual boundary, not as proof of the project's installed runtime or performance.

## Evidence and scope

`source-snapshot.json` freezes both full source items and all three full canonical items. All five answer hashes match the supplied actual500 residual record and were rechecked against the completed actual527 build. The transient chapter disappearance during the parent's rebuild is not reported as an access failure.

`preservation-evidence.json` maps every original answer character through exact ordered retained ranges and separately maps all 35 original paragraphs. This preserves the existing CSRF/SameSite conditions, XSS and streaming Markdown treatment, SSR serialization, SQL/argv distinctions, SSRF checks, SSE framing/UTF-8/EOF limits, MCP transport distinction, post-200 error treatment and every existing variant. No symbol-escape repair is included.

`canonical-targets.json` supplies three verified stable question routes and the concrete conditions found in their destinations. `official-sources.json` records the official references and narrow claims. The references are source-check evidence, not a declaration of live streaming/browser acceptance.

## Checks and handoff

Run `python verify_candidate.py --dist /absolute/path/to/integration-site/dist` to recheck the exact baseline, identities, unchanged leads and canonical items, inserted-fragment structure, links, full preservation and candidate hashes. It reads only and does not build or alter the site.

Only apply `records.json` through the existing authoring mechanism after the exact-before guard passes. If another candidate edits either whole answer first, reconcile the insertions against that result; do not overwrite it using this stale whole-answer replacement. `insertions.json` retains exact insertion anchors and fragments for that review.

This work writes only this candidate directory. It does not modify integration-site, run a build/browser/aggregate, or close the actual500/527 residual findings. Final applied-site verification remains separate.
