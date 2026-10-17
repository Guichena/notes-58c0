-- MySQL 8.4.0 teaching example; not executed. Use a new empty local schema.
SET time_zone='+00:00';
CREATE TABLE ban_state (
 tenant_id BIGINT NOT NULL, user_id BIGINT NOT NULL, generation BIGINT NOT NULL,
 status VARCHAR(16) NOT NULL, banned_until DATETIME(6) NOT NULL,
 PRIMARY KEY(tenant_id,user_id), KEY due_bans(status,banned_until,user_id),
 CHECK(generation>=0)
) ENGINE=InnoDB;
CREATE TABLE ban_event (
 tenant_id BIGINT NOT NULL,user_id BIGINT NOT NULL,generation BIGINT NOT NULL,
 event_type VARCHAR(16) NOT NULL,
 PRIMARY KEY(tenant_id,user_id,generation,event_type)
) ENGINE=InnoDB;
INSERT INTO ban_state VALUES(1,42,7,'BANNED','2026-10-10 00:00:00.000000');
SET @tenant=1,@user=42,@generation=7;
START TRANSACTION;
UPDATE ban_state SET status='ACTIVE'
WHERE tenant_id=@tenant AND user_id=@user AND generation=@generation
 AND status='BANNED' AND banned_until<=UTC_TIMESTAMP(6);
SET @changed=ROW_COUNT();
INSERT INTO ban_event(tenant_id,user_id,generation,event_type)
SELECT @tenant,@user,@generation,'UNBANNED' WHERE @changed=1;
COMMIT;
-- After confirmed COMMIT, remove exactly '1:42:7' from the Redis ZSet.
-- A connection failure during COMMIT requires reconciliation, not an assumed rollback.
