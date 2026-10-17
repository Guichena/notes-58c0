-- A1：先不提交。
START TRANSACTION;
UPDATE s2_shift SET remaining=remaining-1 WHERE slot_id=1 AND remaining>1;
SET @a_allowed=ROW_COUNT();
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=1 AND on_standby=1 AND @a_allowed=1;
SELECT ROW_COUNT() AS a_device_changed; -- 预期 1
