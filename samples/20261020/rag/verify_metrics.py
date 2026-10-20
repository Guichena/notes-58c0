"""教学假设数据的算术核对，不运行检索器或语言模型。Python 3 stdlib。"""
import math

def metrics(ranking, relevant, k):
    assert k > 0
    unique = list(dict.fromkeys(ranking))[:k]
    hits = sum(x in relevant for x in unique)
    rr = next((1 / (i + 1) for i, x in enumerate(unique) if x in relevant), 0)
    dcg = sum((1 if x in relevant else 0) / math.log2(i + 2)
              for i, x in enumerate(unique))
    ideal = sum(1 / math.log2(i + 2) for i in range(min(k, len(relevant))))
    return dict(precision=hits/k, recall=hits/len(relevant) if relevant else None,
                hit=int(hits>0), mrr=rr, ndcg=dcg/ideal if ideal else None)

r = {'A', 'B', 'C'}
before = metrics(['D', 'A', 'B'], r, 3)
after = metrics(['A', 'B', 'C'], r, 3)
assert math.isclose(before['precision'], 2/3)
assert math.isclose(before['recall'], 2/3)
assert before['hit'] == 1 and before['mrr'] == .5
assert math.isclose(before['ndcg'], 0.5307212739772434)
assert all(v == 1 for v in after.values())
assert metrics(['A'], r, 3)['precision'] == 1/3  # 空位按不相关
assert metrics(['A', 'A', 'B'], r, 3)['precision'] == 2/3  # 去重
assert metrics([], r, 3)['mrr'] == 0
assert metrics([], set(), 3)['recall'] is None
assert metrics([], set(), 3)['ndcg'] is None
print('Hypothetical metrics arithmetic only; no retrieval/model run.')
print('before:', before)
print('after:', after)
print('Answer supported claims: 2/3; required fact coverage: 2/3; item correctness: 0')
print('PASS: arithmetic, empty results, duplicate results, under-filled k, no relevant items')
