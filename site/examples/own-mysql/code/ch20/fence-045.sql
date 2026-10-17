-- B2
SELECT ROW_COUNT() AS b_changed; -- 初值 10 时预期 1
COMMIT;
SELECT available,version FROM s2_stock WHERE sku=1; -- 预期 (8,2)
