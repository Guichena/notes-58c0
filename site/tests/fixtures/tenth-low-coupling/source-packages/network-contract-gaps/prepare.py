"""Prepare two answer-only candidates. Never writes integration-site or aggregate files."""
import copy
import hashlib
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]

def digest(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def save(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

snapshot = json.loads((HERE / "source-snapshot.json").read_text())
by_key = {r["stableReviewKey"]: r for r in snapshot["rows"]}

CORS = '''<h3 class="md-h md-h3">跨源请求要分预检、实际请求和响应读取</h3><p class="md-p">需要预检且没有可复用的预检缓存时，浏览器先发 OPTIONS，按来源、目标方法和请求头检查服务端允许策略；预检不通过，不会发出该次实际请求。符合简单请求条件的跨源请求则可能已到达服务端，随后即使响应不允许脚本读取，也不会撤回已发生的副作用。Postman 不执行浏览器的 CORS 检查，能请求成功不说明浏览器策略正确。</p><p class="md-p">跨源请求采用 credentials: include 等凭据模式时，响应须返回与请求源匹配的 Access-Control-Allow-Origin 和 Access-Control-Allow-Credentials: true，不能用 Access-Control-Allow-Origin: *。服务端应先验证可信来源再返回该源，不能任意回显；Cookie 是否实际携带还受 SameSite、Secure 和浏览器第三方 Cookie 策略约束。</p><p class="md-p">预检通常不带登录 Cookie，CORS 应先于会把它当成未登录而拒绝的认证检查；实际业务请求仍须认证和资源授权。CORS 不是身份认证，也不替代 CSRF 防护。Spring 的局部注解、全局映射、安全过滤链与网关要核对最终生效策略，避免重复或冲突头；具体处理顺序、Allow-Headers/Expose-Headers 和缓存维度见<a href="#/e/own-spring-mvc/q-own-spring-authentication">CORS 与 Spring Security 主答</a>。</p>'''

SSE_THREADS = '''<h3 class="md-h md-h3">SseEmitter 释放的是初始请求线程</h3><p class="md-p">Spring MVC 的 Servlet 异步处理允许控制器返回 SseEmitter 后释放初始请求线程，同时保持响应打开；后续 send 写响应仍可能阻塞，慢客户端会影响写线程。直接调用 SseEmitter.send 的线程由应用调用链安排，不能与 MVC 为 Flux 等响应式返回值的阻塞写配置的 AsyncTaskExecutor 混为一谈，更不能认为所有手动 send 都会自动切到该执行器。</p><p class="md-p">生产者、待发队列和并发写都需有界，完成、超时、错误时幂等清理订阅与定时器，并用连接代际避免旧回调误删新连接。具体隔离与生命周期边界见<a href="#/e/own-juc-systems/q-own-juc-executor-isolation">线程池主答中的 Spring MVC 线程与资源边界</a>；其中 NoteWeave 参数只代表该题注明的源码版本，不能当作通用容量配置。</p>'''

SSE_RECONNECT = '''<h3 class="md-h md-h3">自动重连不等于可靠恢复</h3><p class="md-p">原生 EventSource 在可重试断连后重新发起请求，合法 retry 字段可调整重连等待时间，浏览器还可能增加退避；维护的事件 ID 非空时，重连请求携带 Last-Event-ID。close() 会关闭本对象并停止重连；服务端可对订阅请求返回 HTTP 204 要求停止，非 200 的最终响应或错误的 Content-Type 等失败条件也会停止自动重连。正常事件流读到 EOF 仍可能重连，业务 terminal 或 [DONE] 也不会自动关闭 EventSource，客户端收到约定终态后应调用 close()。</p><p class="md-p">Last-Event-ID 是协议游标，不是客户端业务处理成功的 ACK，更不保证服务端保留了历史。可靠恢复还要校验 runId 所属用户，在约定保留窗口内按连续序号重放并去重；历史过期时明确返回快照或不能增量恢复。恢复观察与重新执行生成、取消任务分别处理，完整协议见<a href="#/e/ai-agent-7/6">Agent 流式重连与恢复主答</a>。</p>'''

specs = [
    ("own-network-web#q-own-network-web-security", [
        ('<h3 class="md-h md-h3">CSRF 为什么不需要读到响应</h3>', CORS, "cors-stages")
    ]),
    ("own-network-web#q-own-network-sse", [
        ('<h3 class="md-h md-h3">心跳、缓冲与错误分别解决什么</h3>', SSE_THREADS, "sse-threads"),
        ('<h3 class="md-h md-h3">标签</h3>', SSE_RECONNECT, "sse-reconnect")
    ])
]

records, leaves, candidates, preservation, insertions = [], [], [], [], []
for key, additions in specs:
    source = by_key[key]
    item = source["item"]
    before = item["a"]
    after = before
    points = []
    for anchor, fragment, label in additions:
        assert before.count(anchor) == 1, (key, anchor)
        after = after.replace(anchor, fragment + anchor, 1)
        points.append((before.index(anchor), fragment, label))
        (HERE / (label + ".insert.html")).write_text(fragment)
        insertions.append({"stableReviewKey": key, "label": label, "insertBeforeExact": anchor,
                           "fragment": fragment, "fragmentSha256": digest(fragment)})
    record = {"entryId": source["entryId"], "itemIndex": source["itemIndex"],
              "questionId": source["questionId"], "path": ["items", source["itemIndex"], "a"],
              "before": before, "after": after,
              "beforeSha256": digest(before), "afterSha256": digest(after),
              "reason": "Add the confirmed CORS/SSE core contract and three verified stable canonical links; retain all original bytes, identity, variants and lead."}
    records.append(record)
    candidate = copy.deepcopy(item)
    candidate["a"] = after
    candidates.append({"stableReviewKey": key, "entryId": source["entryId"], "itemIndex": source["itemIndex"], "item": candidate})
    for field in ["a", "lead"]:
        leaves.append({"stableReviewKey": key, "field": field, "before": item[field], "after": candidate[field],
                       "beforeSha256": digest(item[field]), "afterSha256": digest(candidate[field]),
                       "changed": item[field] != candidate[field]})
    (HERE / (source["questionId"] + ".after.html")).write_text(after)
    # Entire original answer, including variants/table/inline escapes, is mapped exactly.
    cursor, added, ranges = 0, 0, []
    for pos, fragment, label in sorted(points):
        raw = before[cursor:pos]
        assert after[cursor + added:pos + added] == raw
        ranges.append({"beforeStart": cursor, "beforeEnd": pos, "afterStart": cursor + added,
                       "afterEnd": pos + added, "sha256": digest(raw), "exactHtml": raw})
        added += len(fragment)
        cursor = pos
    raw = before[cursor:]
    assert after[cursor + added:] == raw
    ranges.append({"beforeStart": cursor, "beforeEnd": len(before), "afterStart": cursor + added,
                   "afterEnd": len(after), "sha256": digest(raw), "exactHtml": raw})
    paragraphs = []
    search_from = 0
    for i, m in enumerate(re.finditer(r"<p\b[^>]*>.*?</p>", before, re.S)):
        block = m.group(0)
        at = after.index(block, search_from)
        paragraphs.append({"ordinal": i, "beforeOffset": m.start(), "afterOffset": at,
                           "sha256": digest(block), "exactHtml": block})
        search_from = at + len(block)
    preservation.append({"stableReviewKey": key, "method": "Exact ordered original-character ranges plus every paragraph; insertion-only candidate.",
                         "ranges": ranges, "paragraphs": paragraphs,
                         "questionUnchanged": candidate["q"] == item["q"],
                         "nonAnswerFieldsUnchanged": {k: v for k, v in candidate.items() if k != "a"} == {k: v for k, v in item.items() if k != "a"}})

links = [
    ("#/e/own-spring-mvc/q-own-spring-authentication", "own-spring-mvc#q-own-spring-authentication", "CORS 的检查发生在哪里", ["OPTIONS", "预检、实际请求和响应读取三个环节", "Access-Control-Allow-Credentials: true", "Allow-Headers", "Expose-Headers", "Vary", "Spring Security"]),
    ("#/e/own-juc-systems/q-own-juc-executor-isolation", "own-juc-systems#q-own-juc-executor-isolation", "Spring MVC 的线程与资源边界", ["初始请求线程", "后续响应写出", "受控执行器和有界队列", "幂等清理", "连接 ID 或代际号"]),
    ("#/e/ai-agent-7/6", "ai-agent-7#6", "SSE、WebSocket 与流式重连怎么设计？", ["runId", "单调序号", "保留窗口", "去重", "历史已经过期", "Last-Event-ID 只是恢复线索", "runId 所属用户"])
]
targets = []
for href, key, heading, needles in links:
    source = by_key[key]
    assert all(n in source["item"]["a"] for n in needles), key
    targets.append({"href": href, "stableReviewKey": key, "answerSha256": source["aSha256"],
                    "sourceFile": source["sourceFile"], "sourcePath": source["sourcePath"] + ["a"],
                    "verifiedHeading": heading, "verifiedConditions": needles,
                    "destinationModified": False})

save("records.json", {"schemaVersion": 1, "status": "CANDIDATE_ONLY_NOT_APPLIED", "records": records})
save("leaves-before-after.json", {"note": "Four audited a/lead leaves. Only two a leaves change; leads remain exactly unchanged and are not no-op mutation records.", "leaves": leaves})
save("candidate-items.json", {"items": candidates})
save("preservation-evidence.json", {"rows": preservation})
save("insertions.json", {"insertions": insertions})
save("canonical-targets.json", {"targets": targets, "routeEvidence": ["src/app/storage.js qAnchor: item.id || qi", "src/app/routing.js parses #/e/entry/question", "src/app/questions.js focusQuestion resolves stable anchor or zero-based card"]})
print(json.dumps({"records": len(records), "auditedLeaves": len(leaves), "changedLeadLeaves": 0,
                  "preservedParagraphs": sum(len(r["paragraphs"]) for r in preservation),
                  "canonicalTargets": len(targets), "outputDirectory": str(HERE)}, ensure_ascii=False))
