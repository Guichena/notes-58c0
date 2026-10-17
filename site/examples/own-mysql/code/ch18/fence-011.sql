CREATE DATABASE mysql_txn_report_learning;
USE mysql_txn_report_learning;
CREATE TABLE report_sale (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  INDEX ix_report (tenant_id, occurred_at, id)
) ENGINE=InnoDB;
INSERT INTO report_sale VALUES
  (1,7,'2026-01-01 10:00:00.000000',100.00),
  (2,7,'2026-01-02 10:00:00.000000',-20.00),
  (3,8,'2026-01-01 10:00:00.000000',999.00);
