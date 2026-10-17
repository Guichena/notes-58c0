# Corrected teaching runner (separate from the frozen source)

`run_labs_corrected.py` fixes runner lifecycle and reporting. Its optional
full-suite path compiles immutable `../../source/code` plus the separately labeled
`teaching/code/BoundedPoolTeaching.java` and `teaching/tests/BoundedPoolStartupTest.java`.
The lab list explicitly replaces the original `BoundedPool` main with
`BoundedPoolStartupTest`; the other original labs are unchanged. The frozen
`source/scripts/run_labs.py` remains unchanged.

## Targeted runner checks

From the package root:

    python -m unittest discover -s teaching/tests -p test_runner.py -v

These tests run bounded Python subprocess fixtures only. They do not run Java,
C++, Node, Go, services, package installs, or the broad original suite.
The wrong-version test substitutes a Python command emitting a Java 17 version
line. Same-group descendant inspection runs on Linux and is explicitly skipped
on other platforms. The controlled child ignores TERM so escalation is exercised;
a stopped zombie counts as no longer executing, not as a reaped descendant.

## Report contract and limits

- Each invocation initializes `lab-report.json` with a new run ID and
  `outcome: running` before any toolchain checks. Every command is recorded before
  launch and updated after completion/failure; final outcome is separate from
  individual command exits, so output assertions and version checks can fail
  after a command has exited zero.
- Reports are atomically replaced using a temporary file in the same directory.
  A reader sees a complete snapshot. This is not a promise of crash durability
  across filesystem or power failure. Initialization/write errors abort execution
  instead of pretending the report was updated. If storage is unwritable, an old
  report may physically remain, including when a final report write fails. Verify
  the invocation exit, fresh current run ID, and terminal `passed` together; JSON
  alone is not evidence that the latest invocation passed.
- Catchable errors and interruptions record final failure/interruption. An
  uncatchable kill or power loss may leave `running`; it must never be interpreted
  as a passed run. A CLI parse failure occurs before starting a run.
- Use a distinct build directory for concurrent invocations. No locking is provided.
- POSIX child sessions allow TERM then KILL of the command process group, including
  remaining group members after normal direct-child exit. Cleanup has bounded waits;
  process creation itself can exceed the command wait timeout. Signal delivery
  does not prove every descendant has exited. Descendants that
  deliberately change process group/session are outside the cleanup scope.
- Non-POSIX fallback only kills/reaps the direct child. The report labels the scope
  and records cleanup errors, direct-child reaping, and the absence of descendant
  exit verification. A cleanup error makes the run fail.
- Temporary-file output capture avoids inherited-pipe deadlock. Each report stream
  is capped at 1 MiB with a truncation flag; temporary disk capture itself is not
  bounded. These are trusted local teaching labs, not a hostile-code sandbox.

The full-suite command is available for a separately reviewed execution:

    python teaching/scripts/run_labs_corrected.py --build /tmp/juc-teaching-build

It requires an installed Java 21 JDK. `--cpp-js` and `--go` opt into their existing
local toolchains; no downloads or installations are attempted. This revision was
validated using the targeted tests above, not the broad original suite.
