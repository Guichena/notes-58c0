CREATE TABLE video_asset(
 tenant_id BIGINT NOT NULL,asset_id VARCHAR(64) NOT NULL,owner_id BIGINT NOT NULL,
 generation BIGINT NOT NULL CHECK(generation>0),object_key VARCHAR(512),digest VARCHAR(64),
 bytes BIGINT NOT NULL CHECK(bytes>=0),state VARCHAR(12) NOT NULL,
 PRIMARY KEY(tenant_id,asset_id),CHECK(state IN ('UPLOADING','READY','FAILED','DELETED')),
 CHECK(state<>'READY' OR (object_key IS NOT NULL AND digest IS NOT NULL)));
CREATE TABLE upload_session(
 tenant_id BIGINT NOT NULL,upload_id VARCHAR(64) NOT NULL,asset_id VARCHAR(64) NOT NULL,
 part_count INT NOT NULL CHECK(part_count>0),expected_bytes BIGINT NOT NULL CHECK(expected_bytes>=0),
 expires_at BIGINT NOT NULL,state VARCHAR(12) NOT NULL,version BIGINT NOT NULL CHECK(version>=0),
 PRIMARY KEY(tenant_id,upload_id),FOREIGN KEY(tenant_id,asset_id) REFERENCES video_asset(tenant_id,asset_id),
 CHECK(state IN ('OPEN','COMPLETING','COMPLETE','ABORTED')));
CREATE TABLE upload_part(
 tenant_id BIGINT NOT NULL,upload_id VARCHAR(64) NOT NULL,part_no INT NOT NULL CHECK(part_no>0),
 bytes BIGINT NOT NULL CHECK(bytes>=0),digest VARCHAR(64) NOT NULL,object_etag VARCHAR(128) NOT NULL,
 PRIMARY KEY(tenant_id,upload_id,part_no),
 FOREIGN KEY(tenant_id,upload_id) REFERENCES upload_session(tenant_id,upload_id));
-- part_no<=parent.part_count and total expected bytes require application/SQL
-- transactional validation; a cross-row aggregate is not guaranteed by CHECK.
CREATE TABLE video_task(
 tenant_id BIGINT NOT NULL,task_id VARCHAR(64) NOT NULL,asset_id VARCHAR(64) NOT NULL,
 input_generation BIGINT NOT NULL,parser_version VARCHAR(64) NOT NULL,state VARCHAR(16) NOT NULL,
 version BIGINT NOT NULL CHECK(version>=0),PRIMARY KEY(tenant_id,task_id),
 UNIQUE(tenant_id,asset_id,input_generation,parser_version),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES video_asset(tenant_id,asset_id));
CREATE INDEX ix_task_state ON video_task(tenant_id,state,task_id);
CREATE TABLE video_step(
 tenant_id BIGINT NOT NULL,task_id VARCHAR(64) NOT NULL,step VARCHAR(64) NOT NULL,
 output_key VARCHAR(512) NOT NULL,digest VARCHAR(64) NOT NULL,completed_at BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,task_id,step),
 FOREIGN KEY(tenant_id,task_id) REFERENCES video_task(tenant_id,task_id));
