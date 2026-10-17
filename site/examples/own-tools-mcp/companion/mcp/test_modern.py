#!/usr/bin/env python3
"""Cross-language protocol tests. Only self-authored local bounded subprocesses."""
import copy
import json
import pathlib
import subprocess
import sys
import unittest
from modern_server import PREFIX, VERSION, strict_loads

ROOT = pathlib.Path(__file__).resolve().parents[1]


def request(ident, method, **params):
    params["_meta"] = {PREFIX + "protocolVersion": VERSION, PREFIX + "clientCapabilities": {}, PREFIX + "clientInfo": {"name": "python-host", "version": "1.0.0"}}
    return {"jsonrpc": "2.0", "id": ident, "method": method, "params": params}


def exchange(frames, command):
    # Test input/output is bounded at each owned server. communicate drains both pipes concurrently.
    payload = b"".join((json.dumps(f, separators=(",", ":")).encode() if isinstance(f, dict) else f) + b"\n" for f in frames)
    if len(payload) > 60000:
        raise ValueError("test input bound")
    p = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        out, err = p.communicate(payload, timeout=4)
    except BaseException as primary:
        for cleanup in [p.kill, lambda: p.communicate(timeout=2), p.stdin.close, p.stdout.close, p.stderr.close]:
            try:
                cleanup()
            except BaseException as later:
                if later is not primary:
                    primary.add_note("cleanup failed: " + type(later).__name__)
        raise
    if p.returncode != 0 or len(out) > 65536 or len(err) > 8192 or (out and not out.endswith(b"\n")):
        raise AssertionError("child process contract")
    return [strict_loads(line) for line in out.splitlines()]


class Interop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.commands = [["java", "-cp", str(ROOT / "java/classes"), "interview.tools.ModernMcp"], [sys.executable, "-I", str(ROOT / "mcp/modern_server.py")]]

    def test_python_host_to_both_servers(self):
        for command in self.commands:
            with self.subTest(server=command[-1]):
                r = exchange([request("d", "server/discover"), request("l", "tools/list"), request("c", "tools/call", name="sum", arguments={"a": 6, "b": 8})], command)
                self.assertEqual([x["id"] for x in r], ["d", "l", "c"])
                self.assertEqual(r[0]["result"]["supportedVersions"], [VERSION])
                for result in [r[0]["result"], r[1]["result"]]:
                    self.assertEqual(result["cacheScope"], "private")
                    self.assertEqual(result["ttlMs"], 0)
                self.assertEqual(r[2]["result"]["structuredContent"], {"sum": 14})
                for x in r:
                    self.assertEqual(x["result"]["resultType"], "complete")
                    self.assertIn(PREFIX + "serverInfo", x["result"]["_meta"])
                    self.assertNotIn("error", x)

    def test_negative_contract_shared(self):
        bad_meta = request("meta", "tools/list")
        del bad_meta["params"]["_meta"][PREFIX + "clientCapabilities"]
        old = request("old", "server/discover")
        old["params"]["_meta"][PREFIX + "protocolVersion"] = "2025-11-25"
        frames = [bad_meta, old, request("method", "initialize"), request("tool", "tools/call", name="missing"), request("cursor", "tools/list", cursor="invented"), b'{"a":1,"a":2}', b'{', {"jsonrpc": "2.0", "id": None, "method": "tools/list"}]
        for command in self.commands:
            r = exchange(frames, command)
            self.assertEqual([x["error"]["code"] for x in r], [-32602, -32022, -32601, -32602, -32602, -32700, -32700, -32600])
            self.assertEqual(r[1]["error"]["data"], {"requested": "2025-11-25", "supported": [VERSION]})

    def test_argument_failures_are_tool_results(self):
        args = [{"a": True, "b": 2}, {"a": 1.5, "b": 2}, {"a": 1001, "b": 2}, {"a": 1, "b": 2, "x": 0}, {}, []]
        for command in self.commands:
            r = exchange([request(str(i), "tools/call", name="sum", arguments=a) for i, a in enumerate(args)], command)
            self.assertTrue(all(x["result"]["isError"] for x in r))
            self.assertTrue(all("structuredContent" not in x["result"] for x in r))

    def test_no_capability_inheritance_or_notification_response(self):
        a = request("a", "tools/list")
        b = request("b", "tools/list")
        del b["params"]["_meta"]
        notification = {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"requestId": "unknown"}}
        for command in self.commands:
            r = exchange([a, notification, b], command)
            self.assertEqual(len(r), 2)
            self.assertEqual(r[1]["error"]["code"], -32602)

    def test_frame_bounds_and_utf8(self):
        for command in self.commands:
            self.assertEqual(exchange([b"x" * 8200], command), [])
            # Invalid Unicode is fatal framing in Java, parse-error framing in Python; neither executes a tool.
            r = exchange([b'"\xff"'], command)
            self.assertTrue(not r or r[0]["error"]["code"] == -32700)
            r = exchange([b'{"x":"\\uD800"}'], command)
            self.assertEqual(r[0]["error"]["code"], -32700)

    def test_mathematical_integer_and_progress_token(self):
        q = request("integer", "tools/call", name="sum", arguments={"a": 1.0, "b": 2})
        bad = request("badtoken", "tools/list")
        bad["params"]["_meta"]["progressToken"] = 1.5
        for command in self.commands:
            r = exchange([q, bad], command)
            self.assertEqual(r[0]["result"]["structuredContent"], {"sum": 3})
            self.assertEqual(r[1]["error"]["code"], -32602)

    def test_exact_wire_numbers_and_optional_client_info(self):
        def raw_id(token):
            raw = json.dumps(request("REPLACE_ID", "tools/call", name="sum", arguments={"a": 1, "b": 2}))
            return raw.replace('"REPLACE_ID"', token).encode()
        def raw_token(token):
            q = request("progress", "tools/list")
            q["params"]["_meta"]["progressToken"] = "REPLACE_TOKEN"
            return json.dumps(q).replace('"REPLACE_TOKEN"', token).encode()
        omitted = request("omitted", "tools/list")
        del omitted["params"]["_meta"][PREFIX + "clientInfo"]
        explicit_null = request("explicit-null", "tools/list")
        explicit_null["params"]["_meta"][PREFIX + "clientInfo"] = None
        fractional_argument = json.dumps(request("fractional-argument", "tools/call", name="sum", arguments={"a": "REPLACE_NUMBER", "b": 2})).replace('"REPLACE_NUMBER"', '1.0000000000000001').encode()
        for command in self.commands:
            for token in ["1.5", "1.0000000000000001", "9007199254740992.5", "true", "null"]:
                r = exchange([raw_id(token)], command)[0]
                self.assertEqual(r["error"]["code"], -32600)
                self.assertNotIn("result", r)
            for token in ["9223372036854775808", "-9223372036854775809", "1e20"]:
                r = exchange([raw_id(token)], command)[0]
                # Java's bounded integer parser may reject before envelope validation.
                self.assertIn(r["error"]["code"], (-32700, -32600))
                self.assertNotIn("result", r)
            for token in ["1.0", "9223372036854775807", "-9223372036854775808"]:
                r = exchange([raw_id(token)], command)[0]
                self.assertEqual(r["id"], 1 if token == "1.0" else int(token))
                self.assertEqual(r["result"]["structuredContent"], {"sum": 3})
            for token in ["1.0000000000000001", "9007199254740992.5", "true", "null", "1e20"]:
                r = exchange([raw_token(token)], command)[0]
                self.assertEqual(r["error"]["code"], -32602)
            self.assertIn("result", exchange([raw_token("1.0")], command)[0])
            self.assertTrue(exchange([fractional_argument], command)[0]["result"]["isError"])
            r = exchange([omitted, explicit_null], command)
            self.assertIn("result", r[0])
            self.assertEqual(r[1]["error"]["code"], -32602)

    def test_legacy_fixtures_are_separate(self):
        old = json.loads((ROOT / "fixtures/legacy-2025-11-25.json").read_text())
        self.assertEqual(old[0]["method"], "initialize")
        self.assertNotIn("_meta", old[0]["params"])
        self.assertEqual(old[0]["params"]["protocolVersion"], "2025-11-25")


if __name__ == "__main__":
    unittest.main(verbosity=2)
