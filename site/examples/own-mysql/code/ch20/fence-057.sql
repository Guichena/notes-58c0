-- B1：应在 s2_shift 上等待 A。
START TRANSACTION;
UPDATE s2_shift SET remaining=remaining-1 WHERE slot_id=1 AND remaining>1;
