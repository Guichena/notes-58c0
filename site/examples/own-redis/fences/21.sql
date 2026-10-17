CREATE TABLE s5_resource (
  id BIGINT PRIMARY KEY,
  epoch BIGINT NOT NULL,
  payload TEXT NOT NULL
) ENGINE=InnoDB;
INSERT INTO s5_resource VALUES (1,0,'initial');
-- 权威取得新代际：在同一连接、同一事务中执行
START TRANSACTION;
SELECT epoch FROM s5_resource WHERE id=1 FOR UPDATE;
UPDATE s5_resource SET epoch=epoch+1 WHERE id=1;
SELECT epoch FROM s5_resource WHERE id=1; -- 交给本次工作者
COMMIT;
-- 工作完成：? 由绑定参数提供，不拼接 SQL
-- UPDATE s5_resource SET payload=? WHERE id=? AND epoch=?;
