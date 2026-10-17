-- Integer UTC instants are an explicit teaching representation.
CREATE TABLE posts(tenant_id BIGINT NOT NULL,id BIGINT NOT NULL,title VARCHAR(100),
 updated_at BIGINT NOT NULL,visible INTEGER NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE INDEX ix_latest ON posts(tenant_id,visible,updated_at,id);
CREATE TABLE like_state(tenant_id BIGINT NOT NULL,post_id BIGINT NOT NULL,user_id BIGINT NOT NULL,
 liked INTEGER NOT NULL,version BIGINT NOT NULL,updated_at BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,post_id,user_id),CHECK(liked IN (0,1)));
CREATE INDEX ix_user_likes ON like_state(tenant_id,user_id,liked,updated_at,post_id);
CREATE TABLE like_events(event_id VARCHAR(40) PRIMARY KEY,tenant_id BIGINT NOT NULL,
 post_id BIGINT NOT NULL,user_id BIGINT NOT NULL,action VARCHAR(8) NOT NULL,event_time BIGINT NOT NULL);
CREATE INDEX ix_day ON like_events(tenant_id,event_time,post_id,action);
INSERT INTO posts VALUES(1,1,'first',300,1),(1,2,'second',400,1),(1,3,'third',400,1),
 (1,4,'hidden',500,0),(2,1,'other tenant',900,1);
INSERT INTO like_events VALUES('e1',1,1,7,'LIKE',1000),('e2',1,1,7,'UNLIKE',1001),
 ('e3',1,1,7,'LIKE',1002),('e4',1,2,8,'LIKE',1003),('e5',1,3,9,'LIKE',1004),
 ('e6',1,4,10,'LIKE',1005),('e7',2,1,11,'LIKE',1006),
 ('old',1,2,12,'LIKE',999),('next',1,2,13,'LIKE',87400);
-- Explicit interval [1000,87400); gross accepted LIKE transitions, not net/current likes.
SELECT p.id,p.title,COUNT(*) AS likes_today
FROM like_events e JOIN posts p ON p.tenant_id=e.tenant_id AND p.id=e.post_id
WHERE e.tenant_id=1 AND p.visible=1 AND e.action='LIKE'
 AND e.event_time>=1000 AND e.event_time<87400
GROUP BY p.id,p.title ORDER BY likes_today DESC,p.id ASC LIMIT 10;
SELECT id,title,updated_at FROM posts
WHERE tenant_id=1 AND visible=1 ORDER BY updated_at DESC,id DESC LIMIT 10;
