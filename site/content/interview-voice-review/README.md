# Reviewed answer shards

Add independent JSON shards with `{ "schemaVersion": 1, "records": [...] }`.
Copy each field's entryId, path, entryIdentity, questionIdentity (if present), before and beforeSha256 from the inventory. Supply after, afterSha256 (SHA-256 of UTF-8 after), and review: { rationale: "Specific review judgment and preservation checks", reference: "Reference used" }.
Only explicit per-field edits are applied. Empty registry is an identity projection. Do not edit the archived source. Build loads sorted JSON shards after projectNoteDisplay; baseline compatibility mode bypasses this layer. Duplicate targets, stale text, identity drift, missing review rationale and hash mismatch abort the build before output replacement.

Code/java/formula fields and embedded <pre>/<code> spans must remain byte-identical unless review.technicalChangeRationale independently explains the specific technical correction. Merely adopting an oral style does not justify changing executable code or formulas. Keep review disposition ledgers outside this directory: every .json here is treated as an edit registry.

The inventory generator reads the immutable previous delivered dist, never the revised dist. It can therefore regenerate the same review inputs after edits without moving the before-text baseline.

## Complete validation

Run `node scripts/test-interview-voice-review.mjs` after freezing editor shards. It builds and checks the actual edited dist, verifies every edit reverses to the exact immutable 768-entry corpus, and tests guard failures. Then it runs the original historical assertions unchanged in an isolated temporary copy with the new editorial registry empty. This retains historical evidence without pretending intentionally revised answers should equal the old prose. The live revised dist is never rolled back. Plain `npm test` still includes historical final-prose assertions and may intentionally fail after reviewed edits; use this layered validation command for the reviewed version.
