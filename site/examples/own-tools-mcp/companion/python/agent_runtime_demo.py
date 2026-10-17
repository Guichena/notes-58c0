"""Python 3.11+ teaching harness; no network, shell, credentials or real files.

Scope: trusted cooperative async handlers and an in-memory transactional backend.
Not a sandbox. Production needs durable transactions, authenticated policy context,
external operation reconciliation and process isolation for untrusted/blocking code.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
import unittest
from dataclasses import dataclass
from typing import Any, Awaitable, Callable


class ToolError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.code, self.retryable = code, retryable


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False)


def no_duplicate_keys(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError("duplicate JSON key")
        out[key] = value
    return out


def reject_constant(value):
    raise ValueError("non-finite JSON number")


@dataclass(frozen=True)
class ToolSpec:
    fields: dict[str, type]
    readonly: bool
    handler: Callable[[dict, str, str], Awaitable[dict]]


class Backend:
    """A lock makes config changes and the idempotency ledger atomic in this demo."""
    def __init__(self):
        self.configs = {"module_c": {"limit": 10, "version": 0}}
        self.ledger: dict[tuple[str, str], tuple[str, dict]] = {}
        self.lock = asyncio.Lock()
        self.flaky_count = 0
        self.unknown_count = 0
        self.slow_cancelled = False

    async def read(self, args, actor, operation_id):
        return dict(self.configs[args["resource"]])

    async def set_limit(self, args, actor, operation_id):
        if not 1 <= args["limit"] <= 100:
            raise ToolError("VALIDATION", "limit must be between 1 and 100")
        if args["expected_version"] < 0:
            raise ToolError("VALIDATION", "version cannot be negative")
        digest = hashlib.sha256(canonical(args).encode()).hexdigest()
        key = (actor, operation_id)
        async with self.lock:
            previous = self.ledger.get(key)
            if previous:
                if previous[0] != digest:
                    raise ToolError("IDEMPOTENCY_CONFLICT",
                                    "operation ID was already used for other input")
                return dict(previous[1])
            current = self.configs[args["resource"]]
            if current["version"] != args["expected_version"]:
                raise ToolError("VERSION_CONFLICT", "refresh, replan and revalidate")
            result = {"limit": args["limit"], "version": current["version"] + 1}
            # No await between state and ledger updates: demo atomic commit.
            self.configs[args["resource"]] = dict(result)
            self.ledger[key] = (digest, dict(result))
            return result

    async def flaky_read(self, args, actor, operation_id):
        self.flaky_count += 1
        if self.flaky_count == 1:
            raise ToolError("TRANSIENT", "temporary read failure", retryable=True)
        return await self.read(args, actor, operation_id)

    async def slow_read(self, args, actor, operation_id):
        try:
            await asyncio.sleep(1)
            return await self.read(args, actor, operation_id)
        finally:
            self.slow_cancelled = True

    async def unknown_write(self, args, actor, operation_id):
        # Simulates a remote side effect committed before the response is lost.
        self.unknown_count += 1
        await asyncio.sleep(1)
        return {"done": True}

    async def large_read(self, args, actor, operation_id):
        return {"report": "演示内容" * 1000}

    def registry(self):
        read_fields = {"resource": str}
        return {
            "read_config": ToolSpec(read_fields, True, self.read),
            "set_limit": ToolSpec({"resource": str, "limit": int,
                                   "expected_version": int}, False, self.set_limit),
            "flaky_read": ToolSpec(read_fields, True, self.flaky_read),
            "slow_read": ToolSpec(read_fields, True, self.slow_read),
            "unknown_write": ToolSpec(read_fields, False, self.unknown_write),
            "large_read": ToolSpec(read_fields, True, self.large_read),
        }


class Runtime:
    def __init__(self, backend, *, actor="demo-user", allowed=None,
                 resources=None, max_attempts=20, task_seconds=10,
                 timeout=0.05, read_retries=1):
        self.backend = backend
        self.registry = backend.registry()
        self.actor = actor  # Supplied by trusted server auth, never model arguments.
        self.allowed = set(self.registry) if allowed is None else set(allowed)
        self.resources = {"module_c"} if resources is None else set(resources)
        self.max_attempts = max_attempts
        self.deadline = time.monotonic() + task_seconds
        self.timeout, self.read_retries = timeout, read_retries
        self.attempts = 0
        self.traces = []
        self.artifacts = {}  # Private to this runtime in the demo.

    def fail(self, call_id, code, message, retryable=False):
        self.traces.append({"call_id": call_id, "status": "error", "code": code})
        return {"call_id": call_id, "status": "error",
                "error": {"code": code, "message": message,
                          "retryable": retryable}}

    def validate(self, spec, raw):
        if not isinstance(raw, str) or len(raw.encode("utf-8")) > 8192:
            raise ToolError("VALIDATION", "input is not bounded JSON text")
        try:
            args = json.loads(raw, object_pairs_hook=no_duplicate_keys,
                              parse_constant=reject_constant)
        except (ValueError, TypeError, RecursionError):
            raise ToolError("VALIDATION", "invalid or ambiguous JSON")
        if type(args) is not dict or set(args) != set(spec.fields):
            raise ToolError("VALIDATION", "missing or extra fields")
        if any(type(args[k]) is not t for k, t in spec.fields.items()):
            raise ToolError("VALIDATION", "incorrect field type")
        if args["resource"] not in self.resources:
            raise ToolError("AUTHORIZATION", "resource is outside approved scope")
        return args

    def compact(self, data):
        raw = canonical(data).encode("utf-8")
        if len(raw) <= 1024:
            return {"data": data, "truncated": False}
        digest = hashlib.sha256(raw).hexdigest()
        ref = "artifact://" + digest
        self.artifacts[ref] = raw
        # A byte preview is explicitly not a semantic or complete summary.
        preview = raw[:256].decode("utf-8", errors="ignore")
        return {"artifact_ref": ref, "sha256": digest, "bytes": len(raw),
                "preview": preview, "truncated": True}

    async def execute(self, tool, raw, *, call_id, operation_id=""):
        spec = self.registry.get(tool)
        if spec is None:
            return self.fail(call_id, "UNKNOWN_TOOL", "tool is not registered")
        if tool not in self.allowed:
            return self.fail(call_id, "AUTHORIZATION", "tool is not approved")
        if not spec.readonly and (not isinstance(operation_id, str)
                                  or not 1 <= len(operation_id) <= 128):
            return self.fail(call_id, "VALIDATION", "write needs an operation ID")
        try:
            args = self.validate(spec, raw)
        except ToolError as exc:
            return self.fail(call_id, exc.code, str(exc))
        for retry in range(self.read_retries + 1):
            remaining = self.deadline - time.monotonic()
            if self.attempts >= self.max_attempts or remaining <= 0:
                return self.fail(call_id, "BUDGET_EXHAUSTED", "task budget exhausted")
            self.attempts += 1
            started = time.monotonic()
            try:
                data = await asyncio.wait_for(
                    spec.handler(args, self.actor, tool + ":" + operation_id),
                    timeout=min(self.timeout, remaining))
                if type(data) is not dict:
                    raise ToolError("OUTPUT_SCHEMA", "expected an object")
                payload = self.compact(data)
                self.traces.append({"call_id": call_id, "tool": tool,
                                    "status": "ok", "attempt": retry + 1,
                                    "elapsed_ms": round((time.monotonic()-started)*1000)})
                return {"call_id": call_id, "operation_id": operation_id,
                        "status": "ok", **payload}
            except asyncio.TimeoutError:
                code = "TIMEOUT" if spec.readonly else "UNKNOWN_COMMIT"
                return self.fail(call_id, code, "inspect status before further action")
            except ToolError as exc:
                self.traces.append({"call_id": call_id, "tool": tool,
                                    "status": "attempt_error", "code": exc.code})
                if not (spec.readonly and exc.retryable and retry < self.read_retries):
                    return self.fail(call_id, exc.code, str(exc), False)
                # Deterministic tiny backoff for tests. Production: capped full
                # jitter, Retry-After, a shared retry budget and rate limiting.
                await asyncio.sleep(min(0.01 * 2**retry,
                                        max(0, self.deadline - time.monotonic())))
            except asyncio.CancelledError:
                self.traces.append({"call_id": call_id, "status": "cancelled"})
                raise
            except Exception:
                # Don't expose raw exception details or secrets to the model.
                code = "INTERNAL" if spec.readonly else "UNKNOWN_COMMIT"
                return self.fail(call_id, code, "unexpected tool failure")
        raise AssertionError("unreachable")


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.b = Backend()
        self.r = Runtime(self.b)

    async def call(self, tool="read_config", args=None, op="", r=None):
        return await (r or self.r).execute(
            tool, canonical(args or {"resource": "module_c"}),
            call_id="call-test", operation_id=op)

    async def test_read(self):
        self.assertEqual((await self.call())["data"], {"limit": 10, "version": 0})

    async def test_unknown_tool(self):
        self.assertEqual((await self.call("shell"))["error"]["code"], "UNKNOWN_TOOL")

    async def test_strict_schema_and_duplicate_json(self):
        for raw in ['{"resource":"module_c","resource":"module_c"}',
                    '{"resource":"module_c","extra":1}', '{"resource":true}',
                    '{"resource":NaN}', '{']:
            out = await self.r.execute("read_config", raw, call_id="bad")
            self.assertEqual(out["error"]["code"], "VALIDATION")
        out = await self.call("set_limit", {"resource":"module_c",
                             "limit":True,"expected_version":0}, "bad-bool")
        self.assertEqual(out["error"]["code"], "VALIDATION")

    async def test_permissions(self):
        r = Runtime(self.b, allowed={"read_config"})
        out = await self.call("set_limit", {"resource":"module_c",
                             "limit":20,"expected_version":0}, "w1", r)
        self.assertEqual(out["error"]["code"], "AUTHORIZATION")
        out = await self.call(args={"resource": "secret_module"})
        self.assertEqual(out["error"]["code"], "AUTHORIZATION")
        self.assertEqual(self.b.configs["module_c"]["version"], 0)

    async def test_idempotency(self):
        args = {"resource":"module_c", "limit":20, "expected_version":0}
        first = await self.call("set_limit", args, "op1")
        second = await self.call("set_limit", args, "op1")
        self.assertEqual(first["data"], second["data"])
        self.assertEqual(self.b.configs["module_c"]["version"], 1)
        changed = await self.call("set_limit", {**args, "limit":30}, "op1")
        self.assertEqual(changed["error"]["code"], "IDEMPOTENCY_CONFLICT")

    async def test_replay_does_not_bypass_current_permission(self):
        args = {"resource":"module_c", "limit":20, "expected_version":0}
        await self.call("set_limit", args, "op1")
        self.r.allowed.remove("set_limit")
        replay = await self.call("set_limit", args, "op1")
        self.assertEqual(replay["error"]["code"], "AUTHORIZATION")

    async def test_concurrent_cas(self):
        outs = await asyncio.gather(*[
            self.call("set_limit", {"resource":"module_c", "limit":v,
                                    "expected_version":0}, f"op-{v}")
            for v in (20, 30)])
        self.assertEqual(sum(x["status"] == "ok" for x in outs), 1)
        self.assertEqual(sum(x.get("error", {}).get("code") == "VERSION_CONFLICT"
                             for x in outs), 1)

    async def test_read_retry(self):
        self.assertEqual((await self.call("flaky_read"))["status"], "ok")
        self.assertEqual(self.b.flaky_count, 2)

    async def test_read_timeout_is_cancelled(self):
        out = await self.call("slow_read")
        self.assertEqual(out["error"]["code"], "TIMEOUT")
        self.assertTrue(self.b.slow_cancelled)

    async def test_write_timeout_not_retried_or_claimed_rollback(self):
        out = await self.call("unknown_write", op="unknown-1")
        self.assertEqual(out["error"]["code"], "UNKNOWN_COMMIT")
        self.assertEqual(self.b.unknown_count, 1)

    async def test_budget(self):
        r = Runtime(self.b, max_attempts=1)
        out = await self.call("flaky_read", r=r)
        self.assertEqual(out["error"]["code"], "BUDGET_EXHAUSTED")
        self.assertEqual(self.b.flaky_count, 1)

    async def test_large_output_is_retrievable(self):
        out = await self.call("large_read")
        self.assertTrue(out["truncated"])
        raw = self.r.artifacts[out["artifact_ref"]]
        self.assertEqual(hashlib.sha256(raw).hexdigest(), out["sha256"])
        self.assertEqual(json.loads(raw)["report"], "演示内容" * 1000)

    async def test_parent_cancellation_propagates(self):
        task = asyncio.create_task(self.call("slow_read"))
        await asyncio.sleep(0.005)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(self.b.slow_cancelled)


if __name__ == "__main__":
    unittest.main(verbosity=2)

