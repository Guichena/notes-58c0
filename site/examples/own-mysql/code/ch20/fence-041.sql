-- B2：A2 已提交，但 B 仍使用先前算出的常量。
UPDATE s2_stock SET available=@b_next,version=version+1 WHERE sku=1;
COMMIT;
SELECT available,version FROM s2_stock WHERE sku=1; -- 预期 (9,2)
