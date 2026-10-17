-- Run ONLY in a new, disposable local schema named mysql_tx_lab.
-- This script creates tables; it does not drop existing tables or reset real data.
-- MySQL 8.4.0, InnoDB. Request IDs are case-sensitive ASCII; no spaces accepted by Java.
CREATE TABLE accounts (
 id BIGINT PRIMARY KEY, cents BIGINT NOT NULL CHECK(cents>=0),
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 active BOOLEAN NOT NULL
) ENGINE=InnoDB;
CREATE TABLE transfers (
 request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 from_id BIGINT NOT NULL, to_id BIGINT NOT NULL, cents BIGINT NOT NULL CHECK(cents>0),
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
) ENGINE=InnoDB;
-- No foreign keys in transfers: request claim precedes account locks in this bounded design.
-- Every application write must enforce accounts exist; concurrent deletion is out of scope.
INSERT INTO accounts VALUES(1,100000,'CNY',TRUE),(2,100000,'CNY',TRUE);
CREATE TABLE inventory (
 tenant_id BIGINT NOT NULL, sku_id BIGINT NOT NULL,
 stock BIGINT NOT NULL CHECK(stock>=0), version BIGINT NOT NULL CHECK(version>=0),
 PRIMARY KEY(tenant_id,sku_id)
) ENGINE=InnoDB;
INSERT INTO inventory VALUES(1,1,17,0);
CREATE TABLE doc (
 tenant BIGINT NOT NULL,id BIGINT NOT NULL,version BIGINT NOT NULL CHECK(version>=0),
 body VARCHAR(4000) NOT NULL,PRIMARY KEY(tenant,id)
) ENGINE=InnoDB;
CREATE TABLE doc_receipt (
 tenant BIGINT NOT NULL,request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 doc_id BIGINT NOT NULL,expected BIGINT NOT NULL,body VARCHAR(4000) NOT NULL,
 result_version BIGINT NOT NULL,PRIMARY KEY(tenant,request_id)
) ENGINE=InnoDB;
INSERT INTO doc VALUES(1,42,7,'旧'),(2,42,7,'other tenant');
CREATE TABLE bucket (
 id INT PRIMARY KEY,available BIGINT NOT NULL CHECK(available>=0),
 held BIGINT NOT NULL CHECK(held>=0)
) ENGINE=InnoDB;
CREATE TABLE reservation (
 request_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 bucket_id INT NOT NULL,qty BIGINT NOT NULL CHECK(qty>0),
 FOREIGN KEY(bucket_id) REFERENCES bucket(id)
) ENGINE=InnoDB;
INSERT INTO bucket VALUES(1,12,0),(2,12,0);
CREATE TABLE task (
 tenant BIGINT NOT NULL,id BIGINT NOT NULL,state VARCHAR(16) NOT NULL,
 version BIGINT NOT NULL CHECK(version>=0),PRIMARY KEY(tenant,id)
) ENGINE=InnoDB;
CREATE TABLE task_receipt (
 tenant BIGINT NOT NULL,operation_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 task_id BIGINT NOT NULL,expected_state VARCHAR(16) NOT NULL,expected_version BIGINT NOT NULL,
 target VARCHAR(16) NOT NULL,result VARCHAR(32) NOT NULL,PRIMARY KEY(tenant,operation_id)
) ENGINE=InnoDB;
CREATE TABLE task_outbox (
 tenant BIGINT NOT NULL,operation_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 task_id BIGINT NOT NULL,state VARCHAR(16) NOT NULL,version BIGINT NOT NULL,
 PRIMARY KEY(tenant,operation_id),FOREIGN KEY(tenant,task_id) REFERENCES task(tenant,id)
) ENGINE=InnoDB;
INSERT INTO task VALUES(1,1,'NEW',0);
CREATE TABLE lock_probe(id BIGINT PRIMARY KEY,n INT NOT NULL) ENGINE=InnoDB;
INSERT INTO lock_probe VALUES(1,0),(2,0);
