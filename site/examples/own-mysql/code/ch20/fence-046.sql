-- 示例前提：quantity=1，预期 version=7，数据库当前库存=1、version=7。
UPDATE s2_stock
SET available=available-1,version=version+1
WHERE sku=1 AND version=7 AND available>=1;
SELECT ROW_COUNT();
