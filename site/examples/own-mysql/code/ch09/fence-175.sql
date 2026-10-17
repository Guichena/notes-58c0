CREATE TABLE post(tenant_id BIGINT NOT NULL,post_id BIGINT NOT NULL,author_id BIGINT NOT NULL,title VARCHAR(200) NOT NULL,
 status VARCHAR(12) NOT NULL CHECK(status IN('DRAFT','PUBLISHED','DELETED')),body_version BIGINT NOT NULL CHECK(body_version>0),updated_at BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,post_id));
CREATE TABLE post_body(tenant_id BIGINT NOT NULL,post_id BIGINT NOT NULL,body_version BIGINT NOT NULL,
 body_text TEXT,object_key TEXT,content_hash VARCHAR(64) NOT NULL,
 PRIMARY KEY(tenant_id,post_id,body_version),FOREIGN KEY(tenant_id,post_id) REFERENCES post(tenant_id,post_id),
 CHECK((body_text IS NOT NULL AND object_key IS NULL) OR (body_text IS NULL AND object_key IS NOT NULL)));
CREATE TABLE post_count(tenant_id BIGINT NOT NULL,post_id BIGINT NOT NULL,likes BIGINT NOT NULL CHECK(likes>=0),comments BIGINT NOT NULL CHECK(comments>=0),
 projection_version BIGINT NOT NULL CHECK(projection_version>=0),as_of BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,post_id),FOREIGN KEY(tenant_id,post_id) REFERENCES post(tenant_id,post_id));
-- One query can batch several post IDs, with authenticated tenant and access checks.
SELECT p.post_id,p.title,b.body_text,b.object_key,c.likes,c.comments,c.projection_version,c.as_of
 FROM post p JOIN post_body b ON b.tenant_id=p.tenant_id AND b.post_id=p.post_id AND b.body_version=p.body_version
 LEFT JOIN post_count c ON c.tenant_id=p.tenant_id AND c.post_id=p.post_id
 WHERE p.tenant_id=? AND p.post_id IN (?,?) AND p.status='PUBLISHED';
-- NULL counters mean unavailable/not built, NOT necessarily authoritative zero.
