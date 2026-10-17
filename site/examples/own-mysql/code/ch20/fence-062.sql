-- A2：单独发送此句，等待 B 的共享锁。
UPDATE doctor SET on_call=0 WHERE id=1;
