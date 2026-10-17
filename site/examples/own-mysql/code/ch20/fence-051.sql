-- B2：更新另一行，不会因 A 已经改第一行而自动失败。
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=2 AND on_standby=1 AND @b_count>1;
SELECT ROW_COUNT(); -- 1
COMMIT;
SELECT SUM(on_standby) FROM s2_device WHERE slot_id=1; -- 预期 0，违反约束
