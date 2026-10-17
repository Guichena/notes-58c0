-- A1：获得共同冲突点，并读取当前候选集合。
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT slot_id FROM s2_shift WHERE slot_id=1 FOR UPDATE;
SELECT on_standby INTO @a_one FROM s2_device WHERE slot_id=1 AND id=1 FOR UPDATE;
SELECT on_standby INTO @a_two FROM s2_device WHERE slot_id=1 AND id=2 FOR UPDATE;
