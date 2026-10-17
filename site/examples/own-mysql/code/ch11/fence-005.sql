-- Portable fixture. On MySQL use an empty schema with InnoDB as the default engine.
CREATE TABLE purchase (
 id BIGINT PRIMARY KEY, tenant_id BIGINT NOT NULL,
 state VARCHAR(12) NOT NULL, created_at BIGINT NOT NULL, amount_cents BIGINT NOT NULL
);
INSERT INTO purchase VALUES(1,7,'OPEN',100,500),(2,7,'OPEN',200,600),
 (3,7,'CLOSED',200,800),(4,8,'OPEN',200,900),(5,7,'OPEN',200,1000);
CREATE INDEX ix_purchase_listing ON purchase(tenant_id,state,created_at,id);
-- MySQL alternative syntax, not a second index to add to this same fixture:
-- ALTER TABLE purchase ADD INDEX ix_purchase_listing (tenant_id,state,created_at,id);
SELECT id,created_at FROM purchase
WHERE tenant_id=7 AND state='OPEN' AND created_at>=100 AND created_at<300
ORDER BY created_at DESC,id DESC LIMIT 2;
-- Expected id 5 then 2. Inspect actual MySQL plans independently.
