-- MySQL 8.4.0 / InnoDB teaching schema; not executed here.
CREATE TABLE approval_role (
 tenant_id BIGINT NOT NULL, actor_id BIGINT NOT NULL, enabled BOOLEAN NOT NULL,
 PRIMARY KEY(tenant_id,actor_id)
) ENGINE=InnoDB;
CREATE TABLE approval_run (
 tenant_id BIGINT NOT NULL, run_id BIGINT NOT NULL, version BIGINT NOT NULL,
 status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 deadline_at DATETIME(6) NOT NULL,
 approved_payload MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(tenant_id,run_id), CHECK(version>=0)
) ENGINE=InnoDB;
CREATE TABLE approval_receipt (
 tenant_id BIGINT NOT NULL,
 command_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 run_id BIGINT NOT NULL, actor_id BIGINT NOT NULL, expected_version BIGINT NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(tenant_id,command_id)
) ENGINE=InnoDB;
CREATE TABLE external_intent (
 tenant_id BIGINT NOT NULL, business_key BIGINT NOT NULL,
 stable_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 approved_payload MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 epoch BIGINT NOT NULL DEFAULT 0, lease_until DATETIME(6) NULL,
 remote_id VARCHAR(128) NULL,
 PRIMARY KEY(tenant_id,business_key), UNIQUE KEY uq_request(tenant_id,stable_request_id),
 CHECK(epoch>=0)
) ENGINE=InnoDB;
CREATE TABLE approval_audit (
 tenant_id BIGINT NOT NULL, run_id BIGINT NOT NULL,
 command_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id BIGINT NOT NULL, admitted_at DATETIME(6) NOT NULL,
 PRIMARY KEY(tenant_id,command_id)
) ENGINE=InnoDB;
CREATE TABLE external_notice (
 tenant_id BIGINT NOT NULL,
 stable_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 remote_id VARCHAR(128) NOT NULL,
 PRIMARY KEY(tenant_id,stable_request_id,event_type),
 FOREIGN KEY(tenant_id,stable_request_id) REFERENCES external_intent(tenant_id,stable_request_id)
) ENGINE=InnoDB;
-- trusted setup code inserts PENDING + version 0 + immutable server-generated payload/hash.
-- It computes deadline_at from the selected business rule, e.g. created_at + INTERVAL 72 HOUR.
-- This schema intentionally has no credentials, real approver, payload or live endpoint.
INSERT INTO approval_role VALUES(1,10,TRUE);
INSERT INTO approval_run VALUES(1,100,0,'PENDING',UTC_TIMESTAMP(6)+INTERVAL 72 HOUR,
 '{"action":"create","workOrder":"demo"}',
 SHA2('{"action":"create","workOrder":"demo"}',256));
