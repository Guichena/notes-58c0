-- MySQL 8.4.0 / InnoDB, ONLY in a disposable local schema.
-- SETUP: schema.sql already creates lock_probe; otherwise run these ONCE:
-- CREATE TABLE lock_probe(id BIGINT PRIMARY KEY,n INT NOT NULL) ENGINE=InnoDB;
-- INSERT INTO lock_probe VALUES(1,0),(2,0);
-- Ensure no other experiment owns these rows. Reset n=0 before the run.
SELECT @@innodb_deadlock_detect,@@innodb_lock_wait_timeout;
-- Require deadlock_detect=ON; complete gates before timeout. Do not change production settings.

-- A1 in connection A:
START TRANSACTION;
UPDATE lock_probe SET n=n+1 WHERE id=1;
-- B1 in separate connection B, only after A1 returned successfully:
-- START TRANSACTION;
-- UPDATE lock_probe SET n=n+1 WHERE id=2;
-- GATE: BOTH first updates succeeded, neither transaction committed/rolled back.

-- A2: submit in A. It waits, so keep B/O terminals usable:
UPDATE lock_probe SET n=n+1 WHERE id=2;
-- O: verify an A->B wait exists in performance_schema.data_lock_waits.
-- B2: while A2 remains blocked:
-- UPDATE lock_probe SET n=n+1 WHERE id=1;
-- Expect an InnoDB victim error 1213/SQLSTATE 40001, not a fixed A/B victim.
-- In the victim connection: ROLLBACK;
-- In the successful survivor connection: COMMIT;
-- Then SELECT * FROM lock_probe ORDER BY id; expect n=1 for BOTH rows.
-- If any gate fails or 1205/transport error occurs: ROLLBACK both, report aborted run.
-- Once both transactions ended, reset only this disposable fixture:
-- UPDATE lock_probe SET n=0;
