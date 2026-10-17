SELECT id,on_call FROM doctor ORDER BY id;
SELECT SUM(on_call) AS remaining_doctors FROM doctor; -- 预期 1
