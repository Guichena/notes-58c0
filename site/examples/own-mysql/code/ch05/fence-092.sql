-- MySQL 8 InnoDB in a fresh test schema. Default collation governs text equality.
CREATE TABLE unique_probe (
 id BIGINT PRIMARY KEY,
 tenant_id INT NOT NULL,
 email VARCHAR(100),
 UNIQUE (tenant_id,email)
);
INSERT INTO unique_probe VALUES
 (1,1,NULL),(2,1,NULL),(3,2,'a'),(4,1,'a'),(5,1,'');
SELECT tenant_id,email,COUNT(*) AS cnt FROM unique_probe
 GROUP BY tenant_id,email ORDER BY tenant_id,email;
-- These individual statements should fail with duplicate-key errors:
-- INSERT INTO unique_probe VALUES (6,1,'a');
-- INSERT INTO unique_probe VALUES (7,1,'');
-- This is valid; NULL differs from the existing non-NULL and NULL entries:
INSERT INTO unique_probe VALUES (8,1,NULL);
SELECT COUNT(*) AS null_count FROM unique_probe
 WHERE tenant_id=1 AND email IS NULL;
-- Expected null_count: 3.
