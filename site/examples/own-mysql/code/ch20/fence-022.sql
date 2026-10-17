-- B2：确认 A2 已返回。
SELECT balance FROM s2_balance WHERE id=1; -- 预期 100
ROLLBACK;
