#!/usr/bin/env python3
"""MCP 2026-07-28 bounded stdio tools-only teaching server. Standard library, no SDK.
No resources/prompts/MRTR/subscriptions/HTTP/auth service, no mutations. Frame <=8192
bytes; <=128 requests per process. Sequential, bounded local arithmetic only.
"""
import json
from decimal import Decimal
import math
import re
import sys

VERSION = "2026-07-28"
PREFIX = "io.modelcontextprotocol/"
INFO = {"name": "interview-python-tools", "version": "1.0.0"}
SCHEMA = {"type": "object", "properties": {"a": {"type": "integer", "minimum": -1000, "maximum": 1000}, "b": {"type": "integer", "minimum": -1000, "maximum": 1000}}, "required": ["a", "b"], "additionalProperties": False}
TOOLS = [{"name": "sum", "description": "Add two bounded integers; no external effects", "inputSchema": SCHEMA, "outputSchema": {"type": "object", "properties": {"sum": {"type": "integer"}}, "required": ["sum"], "additionalProperties": False}, "annotations": {"readOnlyHint": True}}]
META_KEY = re.compile(r"^(?:[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\/)?(?:[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)?$")


def pairs(items):
    out = {}
    for k, v in items:
        if k in out:
            raise ValueError("duplicate key")
        out[k] = v
    return out


def exact_decimal(token):
    # Classify the wire number before binary floating-point rounding can alter it.
    if len(token) > 64:
        raise ValueError("number token limit")
    try:
        value = Decimal(token)
    except ArithmeticError as exc:
        raise ValueError("invalid number") from exc
    if not value.is_finite() or abs(value.as_tuple().exponent) > 1024:
        raise ValueError("number exponent limit")
    return int(value) if value == value.to_integral_value() else value


def strict_loads(raw):
    if len(raw) > 8192:
        raise ValueError("frame limit")
    def no_constant(_):
        raise ValueError("nonfinite")
    v = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs, parse_constant=no_constant, parse_float=exact_decimal)
    count = 0
    def visit(x, depth):
        nonlocal count
        count += 1
        if depth > 16 or count > 512:
            raise ValueError("complexity limit")
        if isinstance(x, float) and not math.isfinite(x):
            raise ValueError("nonfinite")
        if isinstance(x, str):
            x.encode("utf-8", "strict")
            if len(x) > 4096:
                raise ValueError("string limit")
        if isinstance(x, dict):
            for k, y in x.items():
                k.encode("utf-8", "strict")
                visit(y, depth + 1)
        elif isinstance(x, list):
            if len(x) > 256:
                raise ValueError("array limit")
            for y in x:
                visit(y, depth + 1)
    visit(v, 0)
    return v


def error(ident, code, message, data=None):
    e = {"code": code, "message": message}
    if data is not None:
        e["data"] = data
    r = {"jsonrpc": "2.0", "error": e}
    if ident is not None:
        r["id"] = ident
    return r


def valid_id(x):
    return type(x) is str or (type(x) is int and -(2**63) <= x <= 2**63 - 1)


def handle(q):
    ident = q.get("id") if isinstance(q, dict) else None
    if not isinstance(q, dict) or q.get("jsonrpc") != "2.0" or not isinstance(q.get("method"), str) or "result" in q or "error" in q:
        return error(ident if valid_id(ident) else None, -32600, "Invalid request")
    if "id" not in q:
        # No response to notifications. Arithmetic has no outstanding work when this is read.
        return None
    if not valid_id(ident):
        return error(None, -32600, "Invalid request ID")
    p = q.get("params")
    m = p.get("_meta") if isinstance(p, dict) else None
    if not isinstance(m, dict) or any(not META_KEY.fullmatch(k) for k in m) or not isinstance(m.get(PREFIX + "protocolVersion"), str) or not isinstance(m.get(PREFIX + "clientCapabilities"), dict):
        return error(ident, -32602, "Required request metadata missing or invalid")
    version = m[PREFIX + "protocolVersion"]
    if version != VERSION:
        return error(ident, -32022, "Unsupported protocol version", {"requested": version, "supported": [VERSION]})
    ci = m.get(PREFIX + "clientInfo")
    if PREFIX + "clientInfo" in m and (not isinstance(ci, dict) or not isinstance(ci.get("name"), str) or not isinstance(ci.get("version"), str)):
        return error(ident, -32602, "Invalid clientInfo")
    if "progressToken" in m and not valid_id(m["progressToken"]):
        return error(ident, -32602, "Invalid progress token")
    method = q["method"]
    r = {"resultType": "complete", "_meta": {PREFIX + "serverInfo": INFO}}
    if method == "server/discover":
        r.update(supportedVersions=[VERSION], capabilities={"tools": {}}, ttlMs=0, cacheScope="private")
    elif method == "tools/list":
        if "cursor" in p:
            return error(ident, -32602, "No cursor is issued by this bounded catalog")
        r.update(tools=TOOLS, ttlMs=0, cacheScope="private")
    elif method == "tools/call":
        if p.get("name") != "sum":
            return error(ident, -32602, "Unknown tool")
        a = p.get("arguments", {})
        if not isinstance(a, dict) or set(a) != {"a", "b"} or any(type(a[k]) is not int or not -1000 <= a[k] <= 1000 for k in ("a", "b")):
            r.update(isError=True, content=[{"type": "text", "text": "a and b must be integers in [-1000,1000]"}])
        else:
            data = {"sum": int(a["a"]) + int(a["b"])}
            r.update(isError=False, content=[{"type": "text", "text": json.dumps(data, separators=(",", ":"))}], structuredContent=data)
    else:
        return error(ident, -32601, "Method not found")
    return {"jsonrpc": "2.0", "id": ident, "result": r}


def main():
    # stdout is reserved for protocol frames; stderr text is only diagnostic.
    sys.stderr.write("interview Python stdio server ready\n")
    for _ in range(128):
        raw = sys.stdin.buffer.readline(8194)
        if not raw:
            return
        if len(raw) > 8193 or not raw.endswith(b"\n"):
            return  # fatal framing/resource error; do not resynchronize arbitrary fragments
        try:
            response = handle(strict_loads(raw[:-1]))
        except (ValueError, UnicodeError, RecursionError):
            response = error(None, -32700, "Parse error")
        if response is not None:
            frame = json.dumps(response, ensure_ascii=True, separators=(",", ":"))
            if len(frame.encode()) > 8192:
                raise RuntimeError("bounded server output invariant")
            print(frame, flush=True)


if __name__ == "__main__":
    main()
