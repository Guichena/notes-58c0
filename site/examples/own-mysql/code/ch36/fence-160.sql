-- MySQL 8.4.0 teaching script; not executed. New empty local schema only.
CREATE TABLE source_head (
 tenant_id BIGINT NOT NULL, source_id BIGINT NOT NULL,
 current_version BIGINT NOT NULL, visible_version BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,source_id), CHECK(current_version>=visible_version), CHECK(visible_version>=0)
) ENGINE=InnoDB;
CREATE TABLE source_revision (
 tenant_id BIGINT NOT NULL, source_id BIGINT NOT NULL, version BIGINT NOT NULL,
 payload MEDIUMTEXT NOT NULL, tombstone BOOLEAN NOT NULL,
 PRIMARY KEY(tenant_id,source_id,version)
) ENGINE=InnoDB;
CREATE TABLE source_outbox (
 tenant_id BIGINT NOT NULL, source_id BIGINT NOT NULL, version BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,source_id,version)
) ENGINE=InnoDB;
CREATE TABLE projection_build (
 tenant_id BIGINT NOT NULL, source_id BIGINT NOT NULL, version BIGINT NOT NULL,
 expected_chunks INT NOT NULL, state VARCHAR(16) NOT NULL,
 PRIMARY KEY(tenant_id,source_id,version), CHECK(expected_chunks BETWEEN 0 AND 1000000)
) ENGINE=InnoDB;
CREATE TABLE projection_receipt (
 tenant_id BIGINT NOT NULL, source_id BIGINT NOT NULL, version BIGINT NOT NULL,
 chunk_no INT NOT NULL, PRIMARY KEY(tenant_id,source_id,version,chunk_no), CHECK(chunk_no>=0)
) ENGINE=InnoDB;
INSERT INTO source_head VALUES(1,10,0,0);
-- Demonstration of source-version + outbox + build definition in one transaction.
-- Real callers use a trusted tenant and check each affected-row result before COMMIT.
START TRANSACTION;
UPDATE source_head SET current_version=1
WHERE tenant_id=1 AND source_id=10 AND current_version=0;
INSERT INTO source_revision VALUES(1,10,1,'immutable source version one',FALSE);
INSERT INTO source_outbox VALUES(1,10,1);
INSERT INTO projection_build VALUES(1,10,1,2,'BUILDING');
COMMIT;
-- Only the trusted projection worker records receipts AFTER verifying remote write/search readiness.
-- These are synthetic fixture receipts, not evidence that a real remote index was written.
INSERT INTO projection_receipt VALUES(1,10,1,0),(1,10,1,1);
