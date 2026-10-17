-- A1，独立连接 A
START TRANSACTION;
UPDATE s3_lock SET note='A' WHERE id=1;
-- B1，独立连接 B，在 A1 返回后执行：
-- START TRANSACTION;
-- UPDATE s3_lock SET note='B' WHERE id=2;
-- 闸门：两个首锁都成功，均未结束事务。
-- A2，由 A 发送并等待：
UPDATE s3_lock SET note='A' WHERE id=2;
-- 观察连接确认 A 等 B 的 s3_lock 等待边后，B2 执行：
-- UPDATE s3_lock SET note='B' WHERE id=1;
