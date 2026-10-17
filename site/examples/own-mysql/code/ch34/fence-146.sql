-- MySQL 8.4.0 / InnoDB teaching DDL and JDBC templates; not executed.
-- The ? statements must be prepared and bound separately in JDBC, not run as a mysql script.
CREATE TABLE task_item (
 tenant_id BIGINT NOT NULL, task_id BIGINT NOT NULL, title VARCHAR(200) NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('open','done','deleted')),
 version BIGINT NOT NULL CHECK(version>=0), PRIMARY KEY(tenant_id,task_id),
 KEY ix_task_list(tenant_id,state,task_id)
) ENGINE=InnoDB;
INSERT INTO task_item(tenant_id,task_id,title,state,version) VALUES(?,?,?,?,0);
SELECT task_id,title,state,version FROM task_item WHERE tenant_id=? AND state='open'
 AND task_id>? ORDER BY task_id LIMIT ?;
UPDATE task_item SET title=?,version=version+1
 WHERE tenant_id=? AND task_id=? AND version=? AND version<9223372036854775807;
DELETE FROM task_item WHERE tenant_id=? AND task_id=? AND version=?;
