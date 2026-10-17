UPDATE s2_stock SET available=10,version=0 WHERE sku=1;
COMMIT;
SELECT sku,available,version FROM s2_stock WHERE sku=1; -- (1,10,0)
