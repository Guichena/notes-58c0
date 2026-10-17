CREATE TABLE profile_example (
 tenant_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
 attributes JSON NOT NULL,
 city VARCHAR(80) GENERATED ALWAYS AS
   (JSON_UNQUOTE(JSON_EXTRACT(attributes,'$.city'))) STORED,
 version BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(tenant_id,user_id),
 INDEX ix_city(tenant_id,city),
 CHECK (JSON_TYPE(attributes)='OBJECT')
);
INSERT INTO profile_example(tenant_id,user_id,attributes)
 VALUES(1,7,JSON_OBJECT('city','北京','notifications',CAST('true' AS JSON)));
SELECT user_id FROM profile_example WHERE tenant_id=1 AND city='北京';
UPDATE profile_example
 SET attributes=JSON_SET(attributes,'$.city','上海'),version=version+1
 WHERE tenant_id=1 AND user_id=7 AND version=0;
SELECT attributes->>'$.city' AS city,version FROM profile_example
 WHERE tenant_id=1 AND user_id=7;
