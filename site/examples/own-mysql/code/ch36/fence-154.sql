-- MySQL 8.4.0 / InnoDB teaching schema; not executed. Polling model, not insert-only CDC.
CREATE TABLE s6_request (
 tenant_id BIGINT NOT NULL,
 request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 order_id BIGINT NULL, result_json JSON NULL,
 PRIMARY KEY(tenant_id,request_id)
) ENGINE=InnoDB;
CREATE TABLE s6_outbox (
 tenant_id BIGINT NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 aggregate_id BIGINT NOT NULL, aggregate_version BIGINT NOT NULL,
 event_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload JSON NOT NULL, created_at DATETIME(6) NOT NULL, sent_at DATETIME(6) NULL,
 PRIMARY KEY(tenant_id,event_id),
 UNIQUE KEY uk_event(tenant_id,aggregate_id,aggregate_version,event_type),
 KEY ix_pending(sent_at,created_at,event_id)
) ENGINE=InnoDB;
CREATE TABLE s6_inbox (
 tenant_id BIGINT NOT NULL,
 consumer_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 handled_at DATETIME(6) NOT NULL,
 PRIMARY KEY(tenant_id,consumer_name,event_id)
) ENGINE=InnoDB;
