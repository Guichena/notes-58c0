CREATE TABLE s1_orders (
  id BIGINT PRIMARY KEY,
  tenant_id INT NOT NULL,
  status VARCHAR(12) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  memo VARCHAR(200) NOT NULL,
  KEY ix_filter (tenant_id, status, created_at, id),
  KEY ix_time (tenant_id, created_at, id, status)
) ENGINE=InnoDB;
CREATE TABLE s1_digit (n INT PRIMARY KEY);
INSERT INTO s1_digit VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);
INSERT INTO s1_orders
SELECT n + 1,
       IF(n < 80000, 1, 2 + MOD(n,20)),
       IF(MOD(IF(n < 80000,n,FLOOR((n-80000)/20)),100)=0, 'OPEN', 'CLOSED'),
       TIMESTAMPADD(SECOND,n,'2026-01-01 00:00:00'),
       CAST(10 + MOD(n,10000)/100 AS DECIMAL(12,2)),
       REPEAT('x',100)
FROM (
  SELECT a.n+10*b.n+100*c.n+1000*d.n+10000*e.n AS n
  FROM s1_digit a CROSS JOIN s1_digit b CROSS JOIN s1_digit c
  CROSS JOIN s1_digit d CROSS JOIN s1_digit e
) s;
ANALYZE TABLE s1_orders;

EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders FORCE INDEX (ix_filter)
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders FORCE INDEX (ix_time)
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;

SELECT tenant_id,COUNT(*) AS total,SUM(status='OPEN') AS open_count FROM s1_orders GROUP BY tenant_id ORDER BY tenant_id;
-- 在S1基线完成两条候选路径对照后，再单独执行本场景。
-- 保留tenant=1的OPEN总数800，只改变它们在时间轴上的分布。
START TRANSACTION;
UPDATE s1_orders
SET status='CLOSED'
WHERE tenant_id=1 AND id BETWEEN 70001 AND 80000;
UPDATE s1_orders
SET status='OPEN'
WHERE tenant_id=1 AND id BETWEEN 1 AND 10000
  AND MOD(id-1,100)=1;
COMMIT;
ANALYZE TABLE s1_orders;
SELECT COUNT(*) AS rows_total,
       SUM(status='OPEN') AS rows_open
FROM s1_orders WHERE tenant_id=1;
-- 预期80000、800；这是待数据库实测的断言，不是性能测量。
-- 再重跑上面的两个EXPLAIN ANALYZE，保持租户、时间范围和LIMIT不变。
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders FORCE INDEX (ix_filter)
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders FORCE INDEX (ix_time)
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;
EXPLAIN ANALYZE FORMAT=TREE
SELECT id,created_at,amount
FROM s1_orders
WHERE tenant_id=1 AND status='OPEN'
  AND created_at >= '2026-01-01 00:00:00'
  AND created_at <  '2026-01-02 00:00:00'
ORDER BY created_at DESC,id DESC LIMIT 20;
