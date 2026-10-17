# Exact intro repetition display proposal

Status: candidate only. Live source, data and renderer unchanged.

Live243 scan finds 230 plainly identical intro paragraphs across 90 entries, after the existing exact authored-lead prefix removal. A typical answer displays its conclusion in the highlighted lead, then repeats the identical plain sentence immediately after its first heading. The proposed function suppresses only that second display instance.

Scope:
- Invoke only in the current authored + a.startsWith(lead) branch, on the already sliced body.
- Lead must be exactly the single known essence paragraph and contain plain HTML text only.
- Match only the initial plain paragraph, optionally after one plain-text H2/H3. Preserve the entire heading, whitespace and attributes. No scanning later sections.
- Require literal identical text, without decoding, whitespace folding, fuzzy matching or punctuation normalization.
- Any paragraph with links, anchors, code, inline formatting, attributes other than its exact existing class, or other protected markup is left unchanged.
- Keep all data/search/source/archive/progress keys. No content projection edit.
- Baseline build bypasses the change. Runtime replacement should fail if expected prior authored branch is absent or duplicated.

Required verification before admission:
1. Pure positive/negative tests: exact match, single heading, no heading, differing suffix or whitespace, outline lead, inline code/link/anchor, extra paragraph attributes, unrelated first paragraph, list/table/details before paragraph, legacy leadType, non-prefix lead, mismatched heading tags.
2. Execute actual built qaCardHtml with normal dependencies stubbed; compare old and candidate output for every affected item. Difference must be exactly one target paragraph in qa-rest; lead remains once and all headings, links, anchors, code and downstream HTML remain byte-equal.
3. Every untouched rendered item unchanged; all content/chapter/search/archive bytes unchanged.
4. Full-site tests, source parity, future-authoring regression and actual browser normal/reveal/expand/search navigation.
5. Independent review before root live admission.

The included candidate scan uses the older permissive heading regex; candidate function tightens matching to paired H2/H3. Recompute against final staged data, because ongoing editorial corrections may change candidate counts. No fixed 230-count runtime assumption.
