# Scenario-06 frozen review

Twelve catalog-selected entries; all 45 questions and their full nested fields reviewed. Eight entries have corrections and four sound authored entries are retained verbatim. No live tree was changed.

Apply `exact-guarded-leaf-replacements.json` (29 scalar leaves), validating both original entry SHA and before value SHA. Do not apply both this and the broader compatibility patch file. All nested HTML has an ordered span retention ledger (1710 original spans), with added explanatory paragraphs retained in staged entries. The existing coarse paragraph ledger covers only top-level HTML; use the nested ledger for QA coverage.

Primary sources and explicit historical/version boundaries are listed in primary-source-audit.json. Per-entry dispositions explain retained and corrected variants. Numerical capacities remain hypothetical question inputs; no benchmark or Java test execution is asserted.

Small isolated checks exercised actual compiled QA/doc renderer functions and actual question-anchor semantics in a Node VM with unrelated navigation/status stubs; not a browser visual-layout test. All45 QA containers rendered. Catalog-selected baseline equality, questions/order, explicit anchors, image metadata, code-block counts and local question route were checked. No new code blocks, unrelated topics, routes, or external mutations.

Frozen artifacts must not be overwritten. Any later correction belongs in a separate addendum.
