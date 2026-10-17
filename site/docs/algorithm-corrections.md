# Reviewed algorithm corrections

`content/algorithm-corrections.json` is a finite, independently reviewed set of exact string-leaf replacements. The build applies `scripts/algorithm-corrections.mjs` after the reviewed-content layer. It does not modify original chapters, authoring files, baseline files, or the upstream source archive.

Every record retains the exact before and after value, UTF-8 SHA-256 values, source/review evidence, entry identity and concrete path. The module pins the complete registry hash and finite path list. Admission requires all guards to pass before any copy is changed. Only affected entries are cloned. Reverse projection restores the prior layer exactly for the existing regression oracles. Unrelated future entries, fields and appended templates remain supported; an intentional edit to an already targeted leaf requires a reviewed guard/registry update.

To maintain this layer, review the complete proposed leaf diff and provenance, verify current before values against the prior build layer, preserve any displaced code/examples at an appropriate visible destination, then update the finite registry, its module hash/scope and regression evidence together. Never hand-edit dist. Keep baseline mode as an identity operation. Never relax an upstream guard or oracle to accept a new correction.

The array test correction relocates the entire original CodingBoundaryExtrasTest code card to the linked-list supplement, byte-for-byte, where CodingBoundaryExtras already lives; an explicit local link names its StackCalculator dependency in entry 227. The array supplement receives the relevant ArrayStringBasics regression test. This composition replaces the previous p-list leaf proposal rather than applying two replacements to the same leaf.

Verification includes exact reversal, stale/double-apply rejection, missing/duplicate entries, identity drift, immutable finite scope, prototype paths, future authoring tolerance, byte-exact test-card relocation and local dependency links. Earlier correction-layer tests reverse this layer before comparing their original expectations. Synthetic standalone authoring fixtures explicitly stub only this late layer, as they do the other unrelated projections.

Runtime evidence is bounded by each reviewed record's evidence; prose-only correctness reasoning and static-only changes must not be described as executed tests. A full Node suite does not establish every algorithm's mathematical correctness or render-review completion.

## Second reviewed checkpoint

The same finite algorithm layer now includes 85 independently reviewed leaves from batches 07–08, after the original 158 records without changing them. In the backtracking folds, 08-34 removes only a byte-identical duplicate of the canonical 08-27 leaf: both corrections are admitted atomically, the canonical section retains both complete Java programs and input/output guidance, and the duplicate points to its exact existing section title. Fold ordering and titles remain unchanged.

Four separately reviewed plan04 prose replacements extend the existing generic reviewed-content layer, not the algorithm registry. Its original 37 source records and 29 prior replacements remain exact; the four new records carry plan-review provenance without invented external document IDs. They retain the authored leads and unique tags/facts, remove duplicate wrappers, and replace nonexistent appendix promises with explicit validation guidance. All original authoring and archive bytes remain untouched.

## Third reviewed checkpoint

Batches09–12 append145 independently approved leaves to the prior243 exact records. The separate33-record generic review and37-source registry remains byte-identical. Restored LCS record/method bodies remain exact inside a standalone wrapper; the restored C++ edit-distance and Java Checks bodies remain exact with only the source Markdown fence's terminal newline omitted in rendered code. A source-derived fixture records this boundary explicitly. New headings use neutral learner-facing names and dependency links resolve to actual entry owners.

The sole approved title correction is10-27, entry maximum-sum-increasing-subsequence. Its reverse identity check expects the exact reviewed new title instead of the old title. This exception is pinned to the review ID, entry and one-component title path under the complete registry integrity hash; arbitrary title changes, every route/entry ID change and all other identity drift still fail. Future changes need separate review.

The BoundedRandom5To7 restoration's decoded final code hash equals the previously compiled source that passed235 bounded checks; this is saved exact-source runtime evidence, not a new execution claim. The ShuffleArr correction preserves all pre/code bytes and removes invalid paragraph/card nesting. Test coverage distinguishes source conservation, valid local links, structural HTML checks, bounded execution evidence and browser rendering; none substitutes for the others.

Regression-harness memory remains bounded without dropping assertions: the editorial oracle releases construction-only corpus graphs after initialization, and editorial/late-reference corruption fixtures clone only objects they mutate. Full-corpus equality, code conservation, source hashes and input-immutability assertions remain in place. Tests still run serially; no production guard or behavior is relaxed by this harness change.

## Final bounded source checkpoint

Batches13–15 append47 approved leaves (36,7,4) to the unchanged388-record prefix, for435 total. The independently reviewed input snapshot SHA-256 is208e96b19cba84a7f2e4df0b37d4227f4c6412577d904a78a7dc262474191110. Existing finite scope, exact hashes, identity, stale-input, reversal and future-authoring guards remain in force. The guide cleanup is already part of15-03-composed and is not a separate delta.

The final-wave tests pin the unchanged388 prefix, all47 normalized records, before/after guards, restored decoded code bodies, retained prior cards/anchors at the bounded restoration destinations and visible local owner links. The earlier generic33-record registry is reconstructed using the six exact priorRecord compositions and checked against its original full-file hash; its37 source records and33 prior records also have separate hash oracles. This preserves the earlier oracle while allowing the independently reviewed generic107-record layer.

Saved runtime evidence is reused, not rerun at this source handoff. The batch15 addendum records ValidateStackOrder PASS46234 permutations with source SHA-256 f8051376c22d9d9afda9688715ad220cd0d6ffbee9fa755d2a996f084fa5f67d and compiled class SHA-256 aa0190c0881d29ef6200d35a71708d61f629378dcd8d7bb9c28b9ddf139ee4ce. The full multi-language run_tests.py remains source/syntax reviewed only, not executed. Bounded source checks and saved execution evidence do not establish arbitrary concurrency behavior, complete mathematical correctness, browser review or final-document certification. The combined stage owns the subsequent build and full Node suite.
