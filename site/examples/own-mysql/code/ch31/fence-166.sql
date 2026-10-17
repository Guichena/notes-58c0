CREATE TABLE video_comment (
 tenant_id BIGINT NOT NULL, comment_id BIGINT NOT NULL, video_id BIGINT NOT NULL,
 author_id BIGINT NOT NULL, root_id BIGINT, parent_id BIGINT,
 content TEXT NOT NULL, state VARCHAR(16) NOT NULL CHECK(state IN ('pending','visible','hidden','deleted')),
 created_us BIGINT NOT NULL, version BIGINT NOT NULL CHECK(version>=0),
 request_id VARCHAR(100) NOT NULL,
 PRIMARY KEY(tenant_id,comment_id), UNIQUE(tenant_id,video_id,comment_id),
 UNIQUE(tenant_id,author_id,request_id),
 CHECK((root_id IS NULL AND parent_id IS NULL) OR (root_id IS NOT NULL AND parent_id IS NOT NULL)),
 CHECK(parent_id IS NULL OR parent_id<>comment_id),
 CHECK(root_id IS NULL OR root_id<>comment_id),
 FOREIGN KEY(tenant_id,video_id,root_id) REFERENCES video_comment(tenant_id,video_id,comment_id),
 FOREIGN KEY(tenant_id,video_id,parent_id) REFERENCES video_comment(tenant_id,video_id,comment_id)
);
CREATE INDEX ix_comment_top ON video_comment(tenant_id,video_id,state,root_id,created_us,comment_id);
CREATE INDEX ix_comment_reply ON video_comment(tenant_id,video_id,root_id,state,created_us,comment_id);
CREATE INDEX ix_comment_author ON video_comment(tenant_id,author_id,created_us,comment_id);
-- Top-level page; add the two-column keyset predicate for subsequent pages.
SELECT comment_id,author_id,content,created_us FROM video_comment
 WHERE tenant_id=? AND video_id=? AND root_id IS NULL AND state='visible'
 ORDER BY created_us DESC,comment_id DESC LIMIT ?;
SELECT comment_id,parent_id,author_id,content FROM video_comment
 WHERE tenant_id=? AND video_id=? AND root_id=? AND state='visible'
 ORDER BY created_us,comment_id LIMIT ?;
