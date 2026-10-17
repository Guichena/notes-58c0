#!/usr/bin/env python3
"""Owned local SQLite catalog -> validated snapshot -> actual MCP callback.
No arbitrary code/URL loading. One read-only adapter, configurable exposed name.
Refresh is per request; invalid rows keep the previous snapshot. No restart needed.
"""
import contextlib
import copy
import json
import pathlib
import re
import sqlite3
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from modern_server import TOOLS, handle, strict_loads, error


class Catalog:
    def __init__(self, path):
        self.path = pathlib.Path(path).resolve()
        self.snapshot = None
        self.load()
        if self.snapshot is None:
            raise ValueError("no valid initial catalog")

    def load(self):
        try:
            # Read-only DB connection. The test publisher owns all schema/config writes.
            with contextlib.closing(sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True, timeout=0.2)) as db:
                rows = db.execute("SELECT version,name,adapter,enabled FROM tool_catalog ORDER BY version DESC LIMIT 2").fetchall()
            if len(rows) != 1:
                raise ValueError("exactly one catalog row")
            version, name, adapter, enabled = rows[0]
            if type(version) is not int or version < 1 or not re.fullmatch(r"[a-z][a-z0-9_]{0,31}", name) or adapter != "bounded_sum" or enabled not in (0, 1):
                raise ValueError("invalid catalog")
            if self.snapshot is not None and version < self.snapshot[0]:
                raise ValueError("rollback requires a new monotonic publication version")
            candidate = (version, name, adapter, enabled)
            if self.snapshot is not None and version == self.snapshot[0] and candidate != self.snapshot:
                raise ValueError("same version changed")
            self.snapshot = candidate
        except (sqlite3.Error, TypeError, ValueError):
            sys.stderr.write("catalog refresh rejected; previous snapshot retained\n")
        return self.snapshot

    def dispatch(self, request):
        snapshot = self.load()
        # Validate the real envelope with the underlying protocol implementation first.
        base = handle(request)
        if not isinstance(request, dict) or base is None or not isinstance(request.get("params"), dict):
            return base
        method = request.get("method")
        if method == "tools/list" and "result" in base:
            tool = copy.deepcopy(TOOLS[0])
            tool["name"] = snapshot[1]
            tool["description"] += "; catalog version " + str(snapshot[0])
            base["result"]["tools"] = [tool] if snapshot[3] else []
            return base
        if method == "tools/call":
            # A protocol/meta error has priority over routing errors. Unknown tool -32602 is rerouted only after a separate envelope probe.
            probe = copy.deepcopy(request)
            probe["method"] = "server/discover"
            valid = handle(probe)
            if "error" in valid:
                return valid
            if not snapshot[3] or request["params"].get("name") != snapshot[1]:
                return error(request["id"], -32602, "Tool unavailable in current catalog")
            routed = copy.deepcopy(request)
            routed["params"]["name"] = "sum"
            return handle(routed)  # Actual bounded arithmetic callback, not just a catalog change.
        return base


def main():
    catalog = Catalog(sys.argv[1])
    for _ in range(128):
        line = sys.stdin.buffer.readline(8194)
        if not line:
            return
        if len(line) > 8193 or not line.endswith(b"\n"):
            return
        try:
            result = catalog.dispatch(strict_loads(line[:-1]))
        except (ValueError, UnicodeError, RecursionError):
            result = error(None, -32700, "Parse error")
        if result is not None:
            print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
