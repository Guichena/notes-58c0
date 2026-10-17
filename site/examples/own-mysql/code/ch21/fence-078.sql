-- 初始化一次，自动提交状态
CREATE TABLE upgrade_probe(id INT PRIMARY KEY,n INT NOT NULL) ENGINE=InnoDB;
INSERT INTO upgrade_probe VALUES(1,0);
-- A1
START TRANSACTION;
SELECT * FROM upgrade_probe WHERE id=1 FOR SHARE;
-- B1，在独立连接 B 执行并确认返回：
-- START TRANSACTION;
-- SELECT * FROM upgrade_probe WHERE id=1 FOR SHARE;
-- A2，仅在 B1 返回后提交：
UPDATE upgrade_probe SET n=n+1 WHERE id=1;
-- A2 等待时，由 B 查询 data_lock_waits 确认 A 等 B，再执行 B2：
-- UPDATE upgrade_probe SET n=n+1 WHERE id=1;
