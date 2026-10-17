-- B2：需要升级另一记录的锁，形成等待环。
UPDATE doctor SET on_call=0 WHERE id=2;
