-- Portable value semantics; logical integer UTC instants in a declared unit.
CREATE TABLE leases (
  id BIGINT PRIMARY KEY, tenant_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  state VARCHAR(12) NOT NULL, expires_at BIGINT, version BIGINT NOT NULL
);
CREATE INDEX ix_user_live ON leases(tenant_id,user_id,state,expires_at,id);
CREATE INDEX ix_due ON leases(state,expires_at,id);
INSERT INTO leases VALUES(1,1,7,'ACTIVE',100,0),(2,1,7,'ACTIVE',101,0),
 (3,1,7,'ACTIVE',NULL,0),(4,2,7,'ACTIVE',200,0),(5,1,7,'REVOKED',200,0);
-- At instant 100, IDs 2 and 3 are usable for tenant 1 / user 7.
SELECT id FROM leases WHERE tenant_id=1 AND user_id=7 AND state='ACTIVE'
  AND (expires_at IS NULL OR expires_at>100) ORDER BY id;
-- Cleanup is asynchronous; boundary expires_at=now is already invalid.
SELECT id FROM leases WHERE state='ACTIVE' AND expires_at<=100 ORDER BY expires_at,id;
