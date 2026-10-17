-- A2：B1 的 COMMIT 已返回。
SELECT balance FROM s2_balance WHERE id=1; -- RC 预期 80
ROLLBACK;
