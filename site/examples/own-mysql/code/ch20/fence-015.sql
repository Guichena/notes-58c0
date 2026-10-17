CREATE DATABASE mysql_txn_learning;
USE mysql_txn_learning;
CREATE TABLE s2_stock (
  sku BIGINT PRIMARY KEY,
  available INT NOT NULL,
  version BIGINT NOT NULL
) ENGINE=InnoDB;
INSERT INTO s2_stock VALUES (1,10,0);
CREATE TABLE s2_balance (
  id BIGINT PRIMARY KEY,
  balance INT NOT NULL
) ENGINE=InnoDB;
INSERT INTO s2_balance VALUES (1,100);
CREATE TABLE s2_open (
  id BIGINT PRIMARY KEY,
  status VARCHAR(16) NOT NULL,
  INDEX ix_status(status,id)
) ENGINE=InnoDB;
INSERT INTO s2_open VALUES (1,'OPEN'),(2,'OPEN');
CREATE TABLE p (
  id BIGINT PRIMARY KEY,
  score INT NOT NULL,
  note VARCHAR(40) NOT NULL,
  INDEX ix_score(score,id)
) ENGINE=InnoDB;
INSERT INTO p VALUES (1,10,'old');
CREATE TABLE s2_device (
  slot_id BIGINT NOT NULL,
  id BIGINT NOT NULL,
  on_standby INT NOT NULL,
  PRIMARY KEY(slot_id,id),
  CHECK(on_standby IN (0,1))
) ENGINE=InnoDB;
INSERT INTO s2_device VALUES (1,1,1),(1,2,1);
CREATE TABLE s2_shift (
  slot_id BIGINT PRIMARY KEY,
  remaining INT NOT NULL,
  CHECK(remaining >= 1)
) ENGINE=InnoDB;
INSERT INTO s2_shift VALUES (1,2);
CREATE TABLE doctor (
  id BIGINT PRIMARY KEY,
  on_call INT NOT NULL,
  CHECK(on_call IN (0,1))
) ENGINE=InnoDB;
INSERT INTO doctor VALUES (1,1),(2,1);
