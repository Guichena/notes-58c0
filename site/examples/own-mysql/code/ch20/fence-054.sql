-- A2：示例固定两台设备，停用自己的设备。
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=1 AND on_standby=1 AND (@a_one+@a_two)>1;
SELECT ROW_COUNT(); -- 1
UPDATE s2_shift SET remaining=1 WHERE slot_id=1;
COMMIT;
