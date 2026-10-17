"""Local, dependency-free regression tests; never invokes Java or the full lab suite."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/run_labs_corrected.py'
spec = importlib.util.spec_from_file_location('teaching_runner', SCRIPT)
runner_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner_module)


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.build = Path(self.directory.name)
        self.path = self.build / 'lab-report.json'
        self.path.write_text('{"outcome":"passed","run_id":"old"}')

    def read(self):
        return json.loads(self.path.read_text())

    def invoke(self, action):
        with mock.patch.object(runner_module, 'run_suite', side_effect=action):
            return runner_module.main(['--build', str(self.build)])

    def test_prerequisite_failure_replaces_stale_success(self):
        with mock.patch.object(runner_module.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'Java 21'):
                runner_module.main(['--build', str(self.build)])
        report = self.read()
        self.assertEqual(report['outcome'], 'failed')
        self.assertNotEqual(report['run_id'], 'old')
        self.assertEqual(report['commands'], [])
        self.assertEqual(report['error']['type'], 'RuntimeError')

    def test_initialized_before_checks(self):
        def action(runner, options):
            self.assertEqual(self.read()['outcome'], 'running')
            self.assertEqual(self.read()['commands'], [])
            self.assertNotEqual(self.read()['run_id'], 'old')
        self.invoke(action)
        self.assertEqual(self.read()['outcome'], 'passed')

    def test_wrong_java_version_is_final_failure(self):
        real_run = runner_module.TeachingRunner.run
        def fixture_run(runner, label, command, **kwargs):
            self.assertEqual(label, 'java-version')
            return real_run(runner, label, [sys.executable, '-c',
                            'import sys; print(\'openjdk version "17.0.1"\', file=sys.stderr)'], **kwargs)
        with mock.patch.object(runner_module.shutil, 'which', return_value=sys.executable):
            with mock.patch.object(runner_module.TeachingRunner, 'run', fixture_run):
                with self.assertRaisesRegex(RuntimeError, 'Java 21'):
                    runner_module.main(['--build', str(self.build)])
        report = self.read()
        self.assertEqual(report['commands'][0]['status'], 'passed')
        self.assertEqual(report['outcome'], 'failed')
        self.assertIn('Java 21', report['error']['message'])

    def test_output_assertion_failure_overrides_successful_command(self):
        def action(runner, options):
            result = runner.run('output-check', [sys.executable, '-c', 'print("wrong")'])
            if result.stdout != 'expected\n':
                raise AssertionError('fixture output mismatch')
        with self.assertRaisesRegex(AssertionError, 'output mismatch'):
            self.invoke(action)
        report = self.read()
        self.assertEqual(report['commands'][0]['status'], 'passed')
        self.assertEqual(report['outcome'], 'failed')
        self.assertEqual(report['error']['type'], 'AssertionError')

    def test_launch_failure_is_recorded(self):
        def action(runner, options):
            runner.run('missing', [str(self.build / 'does-not-exist')])
        with self.assertRaises(FileNotFoundError):
            self.invoke(action)
        report = self.read()
        self.assertEqual(report['outcome'], 'failed')
        self.assertEqual(report['commands'][0]['status'], 'launch_error')
        self.assertEqual(report['commands'][0]['error']['type'], 'FileNotFoundError')

    def test_nonzero_exit_records_output(self):
        def action(runner, options):
            runner.run('failure', [sys.executable, '-c', 'import sys; print("seen"); sys.exit(7)'])
        with self.assertRaises(RuntimeError):
            self.invoke(action)
        row = self.read()['commands'][0]
        self.assertEqual(row['exit_code'], 7)
        self.assertEqual(row['status'], 'failed')
        self.assertEqual(row['stdout'], 'seen\n')
        self.assertEqual(self.read()['outcome'], 'failed')

    def test_timeout_records_output_and_reaps_child(self):
        def action(runner, options):
            runner.run('timeout', [sys.executable, '-c', 'import time; print("started", flush=True); time.sleep(60)'], timeout=0.5)
        start = time.monotonic()
        with self.assertRaises(subprocess.TimeoutExpired):
            self.invoke(action)
        self.assertLess(time.monotonic() - start, 5)
        row = self.read()['commands'][0]
        self.assertEqual(row['status'], 'timeout')
        self.assertIn('started', row['stdout'])
        self.assertTrue(row['cleanup']['direct_child_reaped'])
        self.assertFalse(row['cleanup']['descendant_exit_verified'])
        self.assertEqual(self.read()['outcome'], 'failed')

    def test_success_and_input(self):
        def action(runner, options):
            result = runner.run('echo', [sys.executable, '-c', 'import sys; print(sys.stdin.read(), end="")'], input_text='hello\n')
            self.assertEqual(result.stdout, 'hello\n')
        self.invoke(action)
        self.assertEqual(self.read()['outcome'], 'passed')
        self.assertEqual(self.read()['commands'][0]['status'], 'passed')

    def test_atomic_replace_failure_preserves_last_complete_snapshot(self):
        before = self.path.read_text()
        with mock.patch.object(runner_module.os, 'replace', side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):
                runner_module.atomic_json(self.path, {'outcome': 'running'})
        self.assertEqual(self.path.read_text(), before)
        self.assertEqual(list(self.build.glob('.lab-report-*')), [])
        # Failure to initialize propagates; the runner never executes commands.
        with mock.patch.object(runner_module, 'atomic_json', side_effect=OSError('disk failure')):
            with mock.patch.object(runner_module, 'run_suite') as suite:
                with self.assertRaises(OSError):
                    runner_module.main(['--build', str(self.build)])
                suite.assert_not_called()

    @unittest.skipUnless(os.name == 'posix' and Path('/proc').exists(), 'Linux process-state inspection')
    def test_normal_exit_cleans_remaining_group_child(self):
        pidfile = self.build / 'child.pid'
        # Child announces readiness before its parent exits, avoiding a spawn race.
        child = 'import os,signal,time,pathlib; signal.signal(signal.SIGTERM, signal.SIG_IGN); pathlib.Path(' + repr(str(pidfile)) + ').write_text(str(os.getpid())); time.sleep(60)'
        parent = 'import subprocess,sys,time,pathlib; subprocess.Popen([sys.executable,"-c",' + repr(child) + ']); p=pathlib.Path(' + repr(str(pidfile)) + '); deadline=time.monotonic()+5\nwhile not p.exists():\n if time.monotonic()>deadline: raise RuntimeError("child readiness timeout")\n time.sleep(.01)\n'
        pid = None
        try:
            self.invoke(lambda runner, options: runner.run('descendant', [sys.executable, '-c', parent], timeout=8))
            pid = int(pidfile.read_text())
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                stat = Path(f'/proc/{pid}/stat')
                if not stat.exists() or stat.read_text().split(') ')[1].startswith('Z'):
                    break
                time.sleep(.01)
            else:
                self.fail('in-group descendant remained running')
            self.assertFalse(self.read()['commands'][0]['cleanup']['descendant_exit_verified'])
        finally:
            if pid is None and pidfile.exists():
                pid = int(pidfile.read_text())
            if pid:
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass


if __name__ == '__main__':
    unittest.main()
