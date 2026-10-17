-- Portable teaching model. MySQL: choose an explicit charset/collation.
-- Original question has NO tenant filter and has two independent access patterns.
CREATE TABLE original_search_user(user_id BIGINT PRIMARY KEY,
 nickname VARCHAR(100) NOT NULL,single_hobby VARCHAR(100));
CREATE INDEX ix_original_nickname ON original_search_user(nickname);
CREATE INDEX ix_original_hobby ON original_search_user(single_hobby);
INSERT INTO original_search_user VALUES(-1,'same',NULL),(0,'same',NULL),
 (1,'same','hiking'),(2,'same','music'),(3,'other','hiking'),(4,'none',NULL);
-- First page has no previous row: no invented minimum/sentinel predicate.
SELECT user_id,nickname FROM original_search_user
 WHERE nickname='same' ORDER BY user_id LIMIT 2;
-- 0 is the REAL last user_id returned above, not a universal initial value.
SET @last_nickname_id=0;
SELECT user_id,nickname FROM original_search_user
 WHERE nickname='same' AND user_id>@last_nickname_id ORDER BY user_id LIMIT 2;
SELECT COUNT(*) FROM original_search_user WHERE single_hobby='hiking';
-- Separate extension: tenant-scoped users and optional many-to-many hobbies.
CREATE TABLE search_user(tenant_id BIGINT NOT NULL,user_id BIGINT NOT NULL,
 nickname VARCHAR(100) NOT NULL,single_hobby VARCHAR(100),PRIMARY KEY(tenant_id,user_id));
CREATE INDEX ix_user_nickname ON search_user(tenant_id,nickname,user_id);
CREATE INDEX ix_user_single_hobby ON search_user(tenant_id,single_hobby,user_id);
CREATE TABLE user_hobby(tenant_id BIGINT NOT NULL,hobby_id BIGINT NOT NULL,user_id BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,hobby_id,user_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES search_user(tenant_id,user_id));
CREATE INDEX ix_user_hobbies ON user_hobby(tenant_id,user_id,hobby_id);
INSERT INTO search_user VALUES(7,-1,'same',NULL),(7,0,'same',NULL),
 (7,1,'same','hiking'),(7,2,'same','music'),(7,3,'other','hiking'),
 (8,1,'same','hiking'),(7,4,'none',NULL);
INSERT INTO user_hobby VALUES(7,10,1),(7,10,3),(7,20,1),(8,10,1);
SELECT user_id,nickname FROM search_user
 WHERE tenant_id=7 AND nickname='same' ORDER BY user_id LIMIT 2;
-- The preceding tenant page also ends at the actual user_id 0.
SET @last_nickname_id=0;
SELECT user_id,nickname FROM search_user
 WHERE tenant_id=7 AND nickname='same' AND user_id>@last_nickname_id ORDER BY user_id LIMIT 2;
-- Exact one-hobby count, not metadata or an approximate/expired counter.
SELECT COUNT(*) FROM search_user WHERE tenant_id=7 AND single_hobby='hiking';
-- Membership PK prevents duplicate relationships for this count.
SELECT COUNT(*) FROM user_hobby WHERE tenant_id=7 AND hobby_id=10;
