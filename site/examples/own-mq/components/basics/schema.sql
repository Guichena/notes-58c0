-- MySQL 8.4. Use an isolated teaching database; do not point this at production.
CREATE TABLE mq_account (
  id BIGINT PRIMARY KEY,
  balance BIGINT NOT NULL,
  CHECK (balance >= 0)
) ENGINE=InnoDB;
CREATE TABLE mq_inbox (
  subscriber VARCHAR(80) COLLATE utf8mb4_bin NOT NULL,
  event_id VARCHAR(80) COLLATE utf8mb4_bin NOT NULL,
  payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  processed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(subscriber, event_id)
) ENGINE=InnoDB;
INSERT INTO mq_account(id,balance) VALUES(1,1000);
