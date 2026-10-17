"""Complete local cosine FAISS construction example. FAISS is imported only at execution.
No installation, remote service, permission service, or production persistence is included.
"""
import numpy as np

def normalized_matrix(rows, dimension):
    if not isinstance(dimension, int) or isinstance(dimension, bool) or not 1 <= dimension <= 4096:
        raise ValueError("dimension")
    matrix = np.asarray(rows, dtype=np.float64)
    if matrix.ndim != 2 or matrix.shape[1] != dimension or not 1 <= len(matrix) <= 50000:
        raise ValueError("shape or bounded batch")
    if not np.isfinite(matrix).all():
        raise ValueError("non-finite")
    scales = np.max(np.abs(matrix), axis=1, keepdims=True)
    if (scales == 0).any():
        raise ValueError("zero vector")
    scaled = matrix / scales
    unit = scaled / np.sqrt(np.sum(scaled * scaled, axis=1, keepdims=True))
    return np.ascontiguousarray(unit, dtype=np.float32)

def stable_ids(ids, count):
    values = np.asarray(ids)
    if values.ndim != 1 or len(values) != count or values.dtype.kind not in "iu":
        raise ValueError("integer id shape")
    if (values < 0).any() or (values > np.iinfo(np.int64).max).any() or len(np.unique(values)) != count:
        raise ValueError("negative/duplicate/out-of-range id")
    return np.ascontiguousarray(values, dtype=np.int64)

def build(rows, ids, dimension, *, nlist=None, nprobe=1):
    """Call only with a trusted, already authorized corpus snapshot."""
    matrix = normalized_matrix(rows, dimension)
    identifiers = stable_ids(ids, len(matrix))
    if nlist is not None and (not isinstance(nlist, int) or isinstance(nlist, bool) or not 1 <= nlist <= len(matrix)):
        raise ValueError("nlist")
    if nlist is not None and (not isinstance(nprobe, int) or isinstance(nprobe, bool) or not 1 <= nprobe <= nlist):
        raise ValueError("nprobe")
    import faiss
    if nlist is None:
        index = faiss.IndexIDMap2(faiss.IndexFlatIP(dimension))
    else:
        quantizer = faiss.IndexFlatIP(dimension)
        index = faiss.IndexIVFFlat(quantizer, dimension, nlist, faiss.METRIC_INNER_PRODUCT)
        index.train(matrix)  # Real workloads need a representative training sample.
        index.nprobe = nprobe
    index.add_with_ids(matrix, identifiers)
    return index

def query(index, rows, dimension, k):
    if not isinstance(k, int) or isinstance(k, bool) or not 1 <= k <= 50000:
        raise ValueError("k")
    if index.d != dimension:
        raise ValueError("index dimension")
    queries = normalized_matrix(rows, dimension)
    distances, ids = index.search(queries, k)
    # FAISS may pad missing neighbors with -1; never treat -1 as a document ID.
    return [[(int(i), float(s)) for i, s in zip(row_ids, row_scores) if i >= 0]
            for row_ids, row_scores in zip(ids, distances)]

def demo():
    random = np.random.default_rng(17003)
    rows = random.normal(size=(512, 8))
    ids = np.arange(1000, 1512, dtype=np.int64)
    exact = build(rows, ids, 8)
    approximate = build(rows, ids, 8, nlist=8, nprobe=2)
    return {"flat": query(exact, rows[:2], 8, 5),
            "ivf": query(approximate, rows[:2], 8, 5)}

if __name__ == "__main__":
    print(demo())
