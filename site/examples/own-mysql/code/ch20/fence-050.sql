-- A2：使用自己读到的决策。
UPDATE s2_device SET on_standby=0
WHERE slot_id=1 AND id=1 AND on_standby=1 AND @a_count>1;
SELECT ROW_COUNT(); -- 1
COMMIT;
