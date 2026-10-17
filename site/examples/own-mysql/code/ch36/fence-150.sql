-- MySQL 8.4.0 / InnoDB teaching schema; not executed here. Use a new empty local schema.
CREATE TABLE effect_account (
 tenant_id BIGINT NOT NULL, account_id BIGINT NOT NULL,
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 balance_cents BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,account_id), CHECK(balance_cents>=0)
) ENGINE=InnoDB;
CREATE TABLE effect_inbox (
 tenant_id BIGINT NOT NULL,
 consumer_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 account_id BIGINT NOT NULL, cents BIGINT NOT NULL,
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 result_balance BIGINT NULL,
 PRIMARY KEY(tenant_id,consumer_name,event_id), CHECK(cents>0), CHECK(result_balance>=0)
) ENGINE=InnoDB;
CREATE TABLE effect_outbox (
 tenant_id BIGINT NOT NULL,
 consumer_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 account_id BIGINT NOT NULL, cents BIGINT NOT NULL,
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(tenant_id,consumer_name,event_id), CHECK(cents>0)
) ENGINE=InnoDB;
INSERT INTO effect_account VALUES(1,100,'CNY',100);
