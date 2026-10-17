-- A1
START TRANSACTION;
SELECT * FROM mdl_probe; -- 返回后不提交
-- B1，在独立连接 B 发送：
-- SET SESSION lock_wait_timeout=120;
-- ALTER TABLE mdl_probe COMMENT='lab';
