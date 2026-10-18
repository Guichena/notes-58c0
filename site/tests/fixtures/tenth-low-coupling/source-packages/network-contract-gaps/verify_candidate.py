"""Read-only candidate and exact-live-baseline checks, not built-site acceptance."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--dist", type=Path, default=ROOT / "integration-site/dist")
args = parser.parse_args()

def load(name):
    return json.loads((HERE / name).read_text())

def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()

class FragmentCheck(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        assert tag in {"h3", "p", "a"}, tag
        self.stack.append(tag)
        if tag == "a":
            self.links.append(dict(attrs)["href"])
    def handle_endtag(self, tag):
        assert self.stack and self.stack.pop() == tag, tag

snapshot = load("source-snapshot.json")["rows"]
source_by_key = {x["stableReviewKey"]: x for x in snapshot}
actual = {}
for p in (args.dist / "data/chapters").glob("*.json"):
    for e in json.loads(p.read_text()).get("entries", []):
        for i, item in enumerate(e.get("items", [])):
            actual[e["id"] + "#" + str(item.get("id", i))] = item

guards = []
for source in snapshot:
    key = source["stableReviewKey"]
    assert key in actual, key
    assert actual[key] == source["item"], (key, "Source item drifted; reconcile before application")
    for field, hash_key in [("a", "aSha256"), ("lead", "leadSha256")]:
        assert sha(actual[key][field]) == source[hash_key], (key, field)
    guards.append({"stableReviewKey": key, "answerSha256": source["aSha256"], "leadSha256": source["leadSha256"], "matchesLiveActual": True})

expected_500 = {
    "own-network-web#q-own-network-web-security": "3800854f26b94f5e46ec421939c59108d72ddd205f5e10d9f8f436b811953497",
    "own-network-web#q-own-network-sse": "e0ab2413ff2962825a04693502beb41742ba0d6e2567a92a216aa717f09dc2ab",
    "own-spring-mvc#q-own-spring-authentication": "5a63a8e1a9edbcca165b364c186325a4f7cb8fe66c58a2ccab56f0bf21a1c668",
    "own-juc-systems#q-own-juc-executor-isolation": "3985e1d88a02766919af1573e42fa54874f224524ac73a9cbac2b64681acabba",
    "ai-agent-7#6": "f76f7de9a12999eb922401f43ee75fe7933399cd7e8461eef2b8a1a7385d6db2"
}
assert {s["stableReviewKey"]: s["aSha256"] for s in snapshot} == expected_500
records = load("records.json")["records"]
leaves = load("leaves-before-after.json")["leaves"]
preserved = load("preservation-evidence.json")["rows"]
candidates = {x["stableReviewKey"]: x["item"] for x in load("candidate-items.json")["items"]}
insertions = load("insertions.json")["insertions"]
assert len(records) == 2 and len(candidates) == 2 and len(leaves) == 4
assert sum(x["changed"] for x in leaves) == 2

for record in records:
    key = record["entryId"] + "#" + record["questionId"]
    before, after = record["before"], record["after"]
    assert record["path"] == ["items", source_by_key[key]["itemIndex"], "a"]
    assert record["beforeSha256"] == sha(before) and record["afterSha256"] == sha(after)
    assert before == actual[key]["a"] and after == candidates[key]["a"]
    rebuilt = before
    for ins in [x for x in insertions if x["stableReviewKey"] == key]:
        assert sha(ins["fragment"]) == ins["fragmentSha256"]
        assert rebuilt.count(ins["insertBeforeExact"]) == 1
        rebuilt = rebuilt.replace(ins["insertBeforeExact"], ins["fragment"] + ins["insertBeforeExact"], 1)
    assert rebuilt == after
    assert {k: v for k, v in actual[key].items() if k != "a"} == {k: v for k, v in candidates[key].items() if k != "a"}

for leaf in leaves:
    assert sha(leaf["before"]) == leaf["beforeSha256"]
    assert sha(leaf["after"]) == leaf["afterSha256"]
    assert leaf["before"] == actual[leaf["stableReviewKey"]][leaf["field"]]
    assert leaf["after"] == candidates[leaf["stableReviewKey"]][leaf["field"]]

for row in preserved:
    before = actual[row["stableReviewKey"]]["a"]
    after = candidates[row["stableReviewKey"]]["a"]
    assert "".join(x["exactHtml"] for x in row["ranges"]) == before
    for x in row["ranges"]:
        assert before[x["beforeStart"]:x["beforeEnd"]] == after[x["afterStart"]:x["afterEnd"]] == x["exactHtml"]
        assert sha(x["exactHtml"]) == x["sha256"]
    for x in row["paragraphs"]:
        assert after[x["afterOffset"]:x["afterOffset"] + len(x["exactHtml"])] == x["exactHtml"]
    assert row["questionUnchanged"] and row["nonAnswerFieldsUnchanged"]

links = []
for ins in insertions:
    validator = FragmentCheck()
    validator.feed(ins["fragment"])
    validator.close()
    assert not validator.stack
    links.extend(validator.links)
targets = load("canonical-targets.json")["targets"]
assert sorted(links) == sorted(t["href"] for t in targets)
for target in targets:
    key = target["stableReviewKey"]
    assert sha(actual[key]["a"]) == target["answerSha256"]
    assert all(condition in actual[key]["a"] for condition in target["verifiedConditions"])
    assert target["href"] == "#/e/" + key.replace("#", "/")

print(json.dumps({
    "status": "PASS_CANDIDATE_ONLY", "actualDist": str(args.dist),
    "changedAnswers": 2, "unchangedLeads": 2, "unchangedCanonicalTargets": 3,
    "insertions": len(insertions), "preservedOriginalParagraphs": sum(len(x["paragraphs"]) for x in preserved),
    "allOriginalAnswerCharactersPreserved": True, "questionAndStableIdentityUnchanged": True,
    "existingSymbolEscapesUntouched": True, "actual500AnswersMatchCurrent527": True,
    "actualLeafGuards": guards, "sourceOrBuildWritten": False,
    "buildRun": False, "browserRun": False, "aggregateRun": False,
    "finalActualAcceptance": False
}, ensure_ascii=False, indent=2))
