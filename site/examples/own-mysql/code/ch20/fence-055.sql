-- B2
SELECT on_standby INTO @b_one FROM s2_device WHERE slot_id=1 AND id=1 FOR UPDATE;
SELECT on_standby INTO @b_two FROM s2_device WHERE slot_id=1 AND id=2 FOR UPDATE;
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=2 AND on_standby=1 AND (@b_one+@b_two)>1;
SELECT ROW_COUNT(); -- 预期 0，剩余待命数为 1
ROLLBACK;
SELECT id,on_standby FROM s2_device WHERE slot_id=1 ORDER BY id; -- (1,0),(2,1)
