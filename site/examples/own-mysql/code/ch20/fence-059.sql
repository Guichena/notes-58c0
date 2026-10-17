UPDATE doctor SET on_call=1;
COMMIT;
SELECT @@global.innodb_deadlock_detect;
