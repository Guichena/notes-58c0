-- One row per business order. Amount is an integer minor unit; currencies stay separate.
CREATE TABLE crm_order (
 tenant_id BIGINT NOT NULL,id BIGINT NOT NULL,dept_id BIGINT NOT NULL,
 status VARCHAR(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL
   CHECK(status IN ('OPEN','PAID','REFUNDED')),
 currency VARCHAR(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL
   CHECK(CHAR_LENGTH(currency)=3 AND ASCII(SUBSTRING(currency,1,1)) BETWEEN 65 AND 90
     AND ASCII(SUBSTRING(currency,2,1)) BETWEEN 65 AND 90
     AND ASCII(SUBSTRING(currency,3,1)) BETWEEN 65 AND 90),
 amount_minor BIGINT NOT NULL CHECK(amount_minor>=0),
 created_at BIGINT NOT NULL,PRIMARY KEY(tenant_id,id)
);
CREATE INDEX ix_crm_report ON crm_order(tenant_id,created_at,dept_id);
-- Permissions originate from authenticated server-side authorization, never from model-supplied IDs.
CREATE TABLE department_grant (
 tenant_id BIGINT NOT NULL,principal_id BIGINT NOT NULL,role_id BIGINT NOT NULL,
 dept_id BIGINT NOT NULL,PRIMARY KEY(tenant_id,principal_id,role_id,dept_id)
);
CREATE INDEX ix_grant_lookup ON department_grant(tenant_id,principal_id,dept_id);
-- EXISTS avoids multiplying an order when two roles grant the same department.
SELECT o.currency,COUNT(*) AS total_count,
 SUM(CASE WHEN o.status='OPEN' THEN 1 ELSE 0 END) AS open_count,
 SUM(CASE WHEN o.status='PAID' THEN 1 ELSE 0 END) AS paid_count,
 SUM(CASE WHEN o.status='REFUNDED' THEN 1 ELSE 0 END) AS refunded_count,
 SUM(CASE WHEN o.status='PAID' THEN o.amount_minor ELSE 0 END) AS paid_minor
FROM crm_order o
WHERE o.tenant_id=? AND o.created_at>=? AND o.created_at<?
 AND EXISTS(SELECT 1 FROM department_grant g WHERE g.tenant_id=o.tenant_id
   AND g.principal_id=? AND g.dept_id=o.dept_id)
GROUP BY o.currency ORDER BY o.currency;
-- Empty scope returns no rows. Never omit the authorization predicate for an empty IN list.
-- Fresh authorization is required per request; this table is not an immutable permission snapshot.
