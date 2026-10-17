-- MySQL 8.4 / InnoDB. Isolated teaching schema only.
CREATE TABLE effect_account (
  tenant_id BIGINT NOT NULL,
  account_id BIGINT NOT NULL,
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  balance BIGINT NOT NULL CHECK (balance >= 0),
  PRIMARY KEY(tenant_id,account_id)
) ENGINE=InnoDB;
CREATE TABLE effect_inbox (
  tenant_id BIGINT NOT NULL,
  consumer VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  account_id BIGINT NOT NULL,
  cents BIGINT NOT NULL CHECK (cents > 0),
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  result_balance BIGINT NULL,
  PRIMARY KEY(tenant_id,consumer,event_id)
) ENGINE=InnoDB;
CREATE TABLE effect_outbox (
  tenant_id BIGINT NOT NULL,
  consumer VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  account_id BIGINT NOT NULL,
  cents BIGINT NOT NULL,
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  result_balance BIGINT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(tenant_id,consumer,event_id)
) ENGINE=InnoDB;
INSERT INTO effect_account VALUES(1,1,'CNY',1000);
