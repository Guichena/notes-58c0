# Reviewed duplicate-prose consolidation

Initially empty. Add schemaVersion 1 JSON shards only after the voice review is
complete and a duplicate passage has been explicitly reviewed. This layer runs
after voice review, without modifying source files, question order or progress.

Each record uses the same entryId, entryIdentity, questionIdentity (for QA), path,
before, after, beforeSha256, afterSha256 and review.rationale as the voice layer.
Additionally, review.preservation is a nonempty array of exact replacement maps:

- removedText: exact duplicate prose, occurring exactly once at this step
- replacementText: reviewed shorter wording or empty string
- rationale: why this removes repetition while preserving unique detail
- retained: entryId, entryIdentity, path, questionIdentity when applicable,
  excerpt, and fieldSha256 of the complete final retained answer field

Mappings apply sequentially to before and must reproduce after exactly. Retained
evidence is checked against the final consolidated graph, including when reversing.
The reviewer must check semantic equivalence and all unique technical boundaries;
text/hash guards verify evidence integrity, not semantic equivalence. Technical
fields and embedded code cannot be changed through this layer, even with a technical
change rationale. Keep full original before text so every edit can be reversed.
