-- MySQL 8.4.0; standalone teaching schema; UTC DATETIME(6).
CREATE TABLE task(id BIGINT PRIMARY KEY,tenant_id BIGINT NOT NULL,
 status VARCHAR(16) NOT NULL,priority INT NOT NULL,created_at DATETIME(6) NOT NULL) ENGINE=InnoDB;
CREATE INDEX ix_task_order ON task(tenant_id,status,priority,created_at,id);
-- Alternative for a separate run: (tenant_id,status,created_at,priority,id).
INSERT INTO task VALUES
 (1,7,'UNPROCESSED',1,'2026-10-02 00:00:00'),
 (2,7,'UNPROCESSED',1,'2026-10-08 00:00:00'),
 (3,7,'UNPROCESSED',0,'2026-10-01 23:59:59.999999'),
 (4,7,'UNPROCESSED',0,'2026-10-09 00:00:00'),
 (5,7,'DONE',0,'2026-10-05 00:00:00'),
 (6,8,'UNPROCESSED',0,'2026-10-05 00:00:00'),
 (7,7,'UNPROCESSED',1,'2026-10-02 00:00:00'),
 (8,7,'UNPROCESSED',0,'2026-10-04 00:00:00');
SET @tenant=7;
SET @as_of=CAST('2026-10-09 00:00:00.000000' AS DATETIME(6));
SET @lower=DATE_SUB(@as_of,INTERVAL 7 DAY);
SELECT id,priority,created_at FROM task
WHERE tenant_id=@tenant AND status='UNPROCESSED' AND created_at>=@lower AND created_at<@as_of
ORDER BY priority ASC,created_at ASC,id ASC LIMIT 20;
-- Expected IDs: 8,1,7,2. Small correctness fixture, not a 30-million-row benchmark.
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,priority,created_at FROM task
WHERE tenant_id=@tenant AND status='UNPROCESSED' AND created_at>=@lower AND created_at<@as_of
ORDER BY priority ASC,created_at ASC,id ASC LIMIT 20;
-- Authorized, rehearsed DDL only; do not run against production as a learning step:
-- ALTER TABLE task ADD INDEX ix_task_time(tenant_id,status,created_at,priority,id),
-- ALGORITHM=INPLACE, LOCK=NONE;
