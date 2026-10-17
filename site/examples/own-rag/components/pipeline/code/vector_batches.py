"""Bound encoded JSONL payloads; adapter must account for its own envelopes.
This prepares requests, and implements no remote retry or embedding service.
"""
import json
import math

def finite_number(x):
    try:
        return type(x) in (int, float) and math.isfinite(x)
    except OverflowError:
        return False

def batches(records, dimension, max_items=100, max_bytes=1_000_000):
    if any(type(x) is not int or x <= 0 for x in (dimension, max_items, max_bytes)):
        raise ValueError("positive integer bounds required")
    batch, used, ids = [], 0, set()
    for rec in records:
        vector = rec["vector"]
        if len(vector) != dimension or any(not finite_number(x) for x in vector):
            raise ValueError("invalid vector")
        record_id = rec["id"]
        if not isinstance(record_id, str) or not record_id:
            raise ValueError("missing stable id")
        raw = (json.dumps(rec, allow_nan=False, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
        if len(raw) > max_bytes:
            raise ValueError("oversized individual record")
        if batch and (len(batch) == max_items or used + len(raw) > max_bytes or record_id in ids):
            yield batch
            batch, used, ids = [], 0, set()
        # Freeze exactly the validated payload, not a mutable caller dictionary.
        batch.append(raw); used += len(raw); ids.add(record_id)
    if batch:
        yield batch
