UPDATE external_intent
SET epoch=epoch+1, lease_until=UTC_TIMESTAMP(6)+INTERVAL 30 SECOND
WHERE tenant_id=:tenant AND stable_request_id=:request
  AND epoch=:expected_epoch AND epoch<9223372036854775807
  AND state IN ('READY','CREATING','UNKNOWN','MANUAL')
  AND (lease_until IS NULL OR lease_until<=UTC_TIMESTAMP(6));

UPDATE external_intent SET state='CREATING'
WHERE tenant_id=:tenant AND stable_request_id=:request
  AND epoch=:owned_epoch AND state='READY' AND lease_until>UTC_TIMESTAMP(6);

START TRANSACTION;
UPDATE external_intent SET state='OPEN',remote_id=:authoritative_remote_id,lease_until=NULL
WHERE tenant_id=:tenant AND stable_request_id=:request
  AND epoch=:owned_epoch AND state IN ('CREATING','UNKNOWN','MANUAL')
  AND lease_until>UTC_TIMESTAMP(6);
SET @created=ROW_COUNT();
INSERT INTO external_notice(tenant_id,stable_request_id,event_type,remote_id)
SELECT :tenant,:request,'CREATED',:authoritative_remote_id WHERE @created=1;
COMMIT;

UPDATE external_intent SET state='UNKNOWN',lease_until=NULL
WHERE tenant_id=:tenant AND stable_request_id=:request
  AND epoch=:owned_epoch AND state='CREATING' AND lease_until>UTC_TIMESTAMP(6);
