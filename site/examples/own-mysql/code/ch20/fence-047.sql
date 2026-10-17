UPDATE s2_device SET on_standby=1 WHERE slot_id=1;
UPDATE s2_shift SET remaining=2 WHERE slot_id=1;
COMMIT;
