-- B2
SET @b_allowed=ROW_COUNT(); -- 预期 0
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=2 AND on_standby=1 AND @b_allowed=1;
SELECT ROW_COUNT() AS b_device_changed; -- 0
COMMIT;
SELECT remaining FROM s2_shift WHERE slot_id=1; -- 1
SELECT SUM(on_standby) FROM s2_device WHERE slot_id=1; -- 1
