-- A2：先确认 B 的 COMMIT 返回。
SELECT available,version FROM s2_stock WHERE sku=1; -- (10,0)
SELECT available,version FROM s2_stock WHERE sku=1 FOR UPDATE; -- (9,1)
SELECT available,version FROM s2_stock WHERE sku=1; -- 仍 (10,0)，本事务尚未写
ROLLBACK;
