-- A1：UPDATE 返回后先不提交。
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
UPDATE s2_stock
SET available=available-1,version=version+1
WHERE sku=1 AND available>=1;
SELECT ROW_COUNT() AS a_changed; -- 预期 1
