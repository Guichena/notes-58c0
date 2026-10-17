"""Pure HTTP metadata fixtures for 2026-07-28. No socket, HTTP server, OAuth or SSE implementation."""
import base64
import re
import unittest
from modern_server import PREFIX, VERSION

TOKEN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")


def encode(value):
    if type(value) is bool:
        text = str(value).lower()
    elif type(value) is int and abs(value) <= 2**53 - 1:
        text = str(value)
    elif type(value) is str:
        text = value
    else:
        raise ValueError("only safe integer, string, boolean")
    sentinel = text.startswith("=?base64?") and text.endswith("?=")
    if text != text.strip() or sentinel or any(ord(c) < 32 or ord(c) > 126 for c in text):
        return "=?base64?" + base64.b64encode(text.encode("utf-8")).decode("ascii") + "?="
    return text


def decode(text):
    if text.startswith("=?base64?") and text.endswith("?="):
        return base64.b64decode(text[9:-2], validate=True).decode("utf-8", "strict")
    if text != text.strip() or any(ord(c) < 32 or ord(c) > 126 for c in text):
        raise ValueError("unsafe header")
    return text


def annotations(schema):
    """Return statically reachable primitive property paths; reject misplaced annotations."""
    found, names = [], set()
    def walk(node, path, reachable):
        if isinstance(node, dict):
            if "x-mcp-header" in node:
                name = node["x-mcp-header"]
                if not reachable or not path or type(name) is not str or not TOKEN.fullmatch(name) or name.lower() in names or node.get("type") not in ("string", "integer", "boolean"):
                    raise ValueError("invalid header annotation; exclude this tool")
                names.add(name.lower())
                found.append((path, name, node["type"]))
            for key, value in node.items():
                if key == "properties" and isinstance(value, dict):
                    for prop, child in value.items():
                        walk(child, path + (prop,), reachable)
                else:
                    walk(value, path, False)
        elif isinstance(node, list):
            for item in node:
                walk(item, path, False)
    walk(schema, (), True)
    return found


def expected_headers(body, schema=None):
    params = body["params"]
    h = {"mcp-protocol-version": params["_meta"][PREFIX + "protocolVersion"], "mcp-method": body["method"]}
    if body["method"] in ("tools/call", "prompts/get", "resources/read"):
        h["mcp-name"] = encode(params["uri"] if body["method"] == "resources/read" else params["name"])
    if schema is not None:
        for path, name, kind in annotations(schema):
            value = params.get("arguments", {})
            for segment in path:
                value = value.get(segment) if isinstance(value, dict) else None
            if value is not None:
                if (kind == "boolean" and type(value) is not bool) or (kind == "integer" and type(value) is not int) or (kind == "string" and type(value) is not str):
                    raise ValueError("wrong primitive")
                h["mcp-param-" + name.lower()] = encode(value)
    return h


def validate(body, header_items, schema=None):
    """Fixture response: only header/body agreement, not the complete HTTP authorization pipeline."""
    h = {}
    try:
        for key, value in header_items:
            key = key.lower()
            if key in h:
                raise ValueError("ambiguous repeated header")
            h[key] = value
        for key, value in expected_headers(body, schema).items():
            actual = h[key]
            if key == "mcp-name" or key.startswith("mcp-param-"):
                actual, value = decode(actual), decode(value)
            elif actual != actual.strip() or any(ord(c) < 32 or ord(c) > 126 for c in actual):
                raise ValueError("unsafe standard header")
            if actual != value:
                raise ValueError("header mismatch")
    except (ValueError, KeyError, UnicodeError):
        return 400, -32020
    if body["params"]["_meta"][PREFIX + "protocolVersion"] != VERSION:
        return 400, -32022
    return 200, None


class HeaderFixtures(unittest.TestCase):
    def setUp(self):
        self.body = {"method": "tools/call", "params": {"name": "sum", "arguments": {"region": "华东", "limit": 10}, "_meta": {PREFIX + "protocolVersion": VERSION}}}
        self.schema = {"type": "object", "properties": {"region": {"type": "string", "x-mcp-header": "Region"}, "limit": {"type": "integer", "x-mcp-header": "Limit"}}}

    def test_encoding_roundtrip_and_injection(self):
        for text in ["sum", "中文", " padded ", "line\r\nx:evil", "=?base64?literal?=", "", "a\tb"]:
            self.assertEqual(decode(encode(text)), text)
        self.assertEqual(encode(True), "true")
        with self.assertRaises(ValueError):
            encode(2**53)

    def test_sentinel_only_for_name_and_parameter_headers(self):
        h = expected_headers(self.body, self.schema)
        for key in ("mcp-method", "mcp-protocol-version"):
            encoded = "=?base64?" + base64.b64encode(h[key].encode("utf-8")).decode("ascii") + "?="
            with self.subTest(header=key):
                self.assertEqual(validate(self.body, list({**h, key: encoded}.items()), self.schema), (400, -32020))
        for key in ("mcp-name", "mcp-param-limit"):
            encoded = "=?base64?" + base64.b64encode(h[key].encode("utf-8")).decode("ascii") + "?="
            with self.subTest(header=key):
                self.assertEqual(validate(self.body, list({**h, key: encoded}.items()), self.schema), (200, None))

    def test_case_insensitive_names_and_mismatch(self):
        h = expected_headers(self.body, self.schema)
        self.assertEqual(validate(self.body, [(k.upper(), v) for k, v in h.items()], self.schema), (200, None))
        h["mcp-name"] = "other"
        self.assertEqual(validate(self.body, list(h.items()), self.schema), (400, -32020))
        h = expected_headers(self.body, self.schema)
        del h["mcp-param-region"]
        self.assertEqual(validate(self.body, list(h.items()), self.schema), (400, -32020))

    def test_null_absent_and_invalid_annotations(self):
        self.body["params"]["arguments"]["region"] = None
        self.assertNotIn("mcp-param-region", expected_headers(self.body, self.schema))
        for invalid in [{"items": {"x-mcp-header": "A", "type": "string"}}, {"properties": {"x": {"x-mcp-header": "A\nB", "type": "string"}}}, {"properties": {"x": {"x-mcp-header": "A", "type": "number"}}}, {"properties": {"x": {"x-mcp-header": "A", "type": "string"}, "y": {"x-mcp-header": "a", "type": "string"}}}]:
            with self.assertRaises(ValueError):
                annotations(invalid)

    def test_version_headers_and_no_old_session_semantics(self):
        h = expected_headers(self.body, self.schema)
        h["Mcp-Session-Id"] = "ignored-legacy"
        h["Last-Event-ID"] = "ignored-legacy"
        self.assertEqual(validate(self.body, list(h.items()), self.schema), (200, None))
        h["mcp-protocol-version"] = "2025-11-25"
        self.assertEqual(validate(self.body, list(h.items()), self.schema), (400, -32020))
        self.body["params"]["_meta"][PREFIX + "protocolVersion"] = "2025-11-25"
        self.assertEqual(validate(self.body, list(h.items()), self.schema), (400, -32022))


if __name__ == "__main__":
    unittest.main(verbosity=2)
