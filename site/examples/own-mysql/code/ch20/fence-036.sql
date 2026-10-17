-- A2：第一次普通一致性读发生在 B 提交之后。
SELECT available FROM s2_stock WHERE sku=1; -- 预期 9
ROLLBACK;
