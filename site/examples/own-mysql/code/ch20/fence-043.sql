-- B1：只提交这条 UPDATE 到服务器，然后停在等待中。
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
UPDATE s2_stock
SET available=available-1,version=version+1
WHERE sku=1 AND available>=1;
