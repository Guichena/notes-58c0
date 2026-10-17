CREATE TABLE transcript (
 tenant_id BIGINT NOT NULL,video_id BIGINT NOT NULL,revision BIGINT NOT NULL,
 language VARCHAR(32) NOT NULL,parser_version VARCHAR(100) NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('BUILDING','READY','FAILED')),
 full_text TEXT,object_key VARCHAR(512),content_hash VARCHAR(64) NOT NULL,
 byte_length BIGINT NOT NULL CHECK(byte_length>=0),PRIMARY KEY(tenant_id,video_id,revision),
 CHECK((full_text IS NULL)<>(object_key IS NULL))
);
CREATE TABLE transcript_segment (
 tenant_id BIGINT NOT NULL,video_id BIGINT NOT NULL,revision BIGINT NOT NULL,
 segment_id BIGINT NOT NULL,start_ms BIGINT NOT NULL CHECK(start_ms>=0),
 end_ms BIGINT NOT NULL,speaker VARCHAR(100),body TEXT NOT NULL,body_hash VARCHAR(64) NOT NULL,
 PRIMARY KEY(tenant_id,video_id,revision,segment_id),CHECK(end_ms>start_ms),
 FOREIGN KEY(tenant_id,video_id,revision) REFERENCES transcript(tenant_id,video_id,revision)
);
CREATE INDEX ix_segment_time ON transcript_segment(tenant_id,video_id,revision,start_ms,segment_id);
-- Resolve a READY revision once. A timestamp can overlap multiple speaker segments.
SELECT segment_id,start_ms,end_ms,speaker,body FROM transcript_segment
 WHERE tenant_id=? AND video_id=? AND revision=? AND start_ms<? AND end_ms>?
 ORDER BY start_ms,segment_id;
-- TEXT here is a portable bounded fixture. MySQL production may choose MEDIUMTEXT
-- after a measured UTF-8 size budget, or immutable external objects for large bodies.
