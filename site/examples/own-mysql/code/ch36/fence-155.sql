-- MySQL 8.4.0 / InnoDB teaching DDL and separately prepared JDBC templates; not executed.
CREATE TABLE durable_task (
 tenant_id BIGINT NOT NULL, task_id BIGINT NOT NULL, version BIGINT NOT NULL,
 immutable_payload MEDIUMTEXT NOT NULL, deadline_at DATETIME(6) NOT NULL,
 state VARCHAR(16) NOT NULL, epoch BIGINT NOT NULL DEFAULT 0,
 lease_until DATETIME(6) NULL,
 PRIMARY KEY(tenant_id,task_id,version),
 KEY task_scan(state,lease_until,tenant_id,task_id),
 CHECK(epoch>=0), CHECK(version>0)
) ENGINE=InnoDB;
CREATE TABLE task_notice (
 tenant_id BIGINT NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 task_id BIGINT NOT NULL, task_version BIGINT NOT NULL,
 event_type VARCHAR(32) NOT NULL, schema_version INT NOT NULL,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,task_id,task_version) REFERENCES durable_task(tenant_id,task_id,version)
) ENGINE=InnoDB;
-- In one transaction: bind trusted tenant, task identity, immutable version/payload/deadline.
INSERT INTO durable_task(tenant_id,task_id,version,immutable_payload,deadline_at,state)
VALUES(?,?,?,?,?,'PENDING');
INSERT INTO task_notice(tenant_id,event_id,task_id,task_version,event_type,schema_version)
VALUES(?,?,?,?,'EXECUTE',1);
-- Claim candidates in a SHORT transaction, check affected rows=1, read new epoch, COMMIT.
UPDATE durable_task SET state='RUNNING',epoch=epoch+1,
 lease_until=UTC_TIMESTAMP(6)+INTERVAL 30 SECOND
WHERE tenant_id=? AND task_id=? AND version=? AND epoch=?
 AND epoch<9223372036854775807 AND deadline_at>UTC_TIMESTAMP(6)
 AND (state='PENDING' OR (state='RUNNING' AND lease_until<=UTC_TIMESTAMP(6)));
-- Completion requires the same immutable task version and owned epoch; bind state to a server enum.
UPDATE durable_task SET state=?,lease_until=NULL
WHERE tenant_id=? AND task_id=? AND version=? AND epoch=?
 AND state='RUNNING' AND lease_until>UTC_TIMESTAMP(6);
