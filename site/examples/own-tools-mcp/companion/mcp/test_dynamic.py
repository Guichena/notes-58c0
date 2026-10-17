#!/usr/bin/env python3
import contextlib
import concurrent.futures
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from test_modern import request


class Dynamic(unittest.TestCase):
    def test_database_reload_callback_and_last_good_snapshot(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="catalog-", dir=root / "work") as work:
            db_path = pathlib.Path(work) / "catalog.db"
            with contextlib.closing(sqlite3.connect(db_path)) as db:
                db.execute("CREATE TABLE tool_catalog(version INTEGER,name TEXT,adapter TEXT,enabled INTEGER)")
                db.execute("INSERT INTO tool_catalog VALUES(1,'sum_v1','bounded_sum',1)")
                db.commit()
            p = subprocess.Popen([sys.executable, "-I", str(root / "mcp/dynamic_server.py"), str(db_path)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            io = concurrent.futures.ThreadPoolExecutor(max_workers=2)
            stderr = io.submit(p.stderr.read, 8193)
            def exchange(q):
                p.stdin.write(json.dumps(q).encode() + b"\n")
                p.stdin.flush()
                line = io.submit(p.stdout.readline, 8194).result(timeout=2)
                self.assertLessEqual(len(line), 8193)
                return json.loads(line)
            def publish(version, name, adapter="bounded_sum", enabled=1):
                with contextlib.closing(sqlite3.connect(db_path)) as db:
                    db.execute("UPDATE tool_catalog SET version=?,name=?,adapter=?,enabled=?", (version, name, adapter, enabled))
                    db.commit()
            primary = None
            try:
                pid = p.pid
                self.assertEqual(exchange(request("l1", "tools/list"))["result"]["tools"][0]["name"], "sum_v1")
                self.assertEqual(exchange(request("c1", "tools/call", name="sum_v1", arguments={"a": 1, "b": 2}))["result"]["structuredContent"], {"sum": 3})
                publish(2, "sum_v2")
                self.assertEqual(exchange(request("l2", "tools/list"))["result"]["tools"][0]["name"], "sum_v2")
                self.assertEqual(exchange(request("c2", "tools/call", name="sum_v2", arguments={"a": 10, "b": 2}))["result"]["structuredContent"], {"sum": 12})
                self.assertIn("error", exchange(request("old", "tools/call", name="sum_v1", arguments={"a": 1, "b": 2})))
                publish(2, "same_version_tamper")
                self.assertEqual(exchange(request("sameversion", "tools/list"))["result"]["tools"][0]["name"], "sum_v2")
                publish(1, "rollback_without_publication")
                self.assertEqual(exchange(request("rollback", "tools/list"))["result"]["tools"][0]["name"], "sum_v2")
                publish(3, "evil", "arbitrary_shell")
                self.assertEqual(exchange(request("invalid", "tools/list"))["result"]["tools"][0]["name"], "sum_v2")
                publish(4, "sum_v2", enabled=0)
                self.assertEqual(exchange(request("disabled", "tools/list"))["result"]["tools"], [])
                self.assertIn("error", exchange(request("denied", "tools/call", name="sum_v2", arguments={"a": 1, "b": 2})))
                self.assertEqual(pid, p.pid)
                self.assertIsNone(p.poll())
            except BaseException as exc:
                primary = exc
            finally:
                for cleanup in [p.stdin.close, lambda: p.wait(timeout=2), lambda: p.kill() if p.poll() is None else None, lambda: p.wait(timeout=2), p.stdout.close, p.stderr.close, lambda: io.shutdown(wait=True, cancel_futures=True)]:
                    try:
                        cleanup()
                    except BaseException as exc:
                        if primary is None:
                            primary = exc
                        elif exc is not primary:
                            primary.add_note("independent cleanup failed: " + type(exc).__name__)
                self.assertLessEqual(len(stderr.result()), 8192)
            if primary is not None:
                raise primary


if __name__ == "__main__":
    unittest.main(verbosity=2)
