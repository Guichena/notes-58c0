-- Independent relational model, not a claim about ChatGPT internal storage.
CREATE TABLE conversation (
 tenant_id BIGINT NOT NULL, conversation_id BIGINT NOT NULL, owner_id BIGINT NOT NULL,
 title VARCHAR(200) NOT NULL, status VARCHAR(16) NOT NULL,
 version BIGINT NOT NULL CHECK(version>=0), created_us BIGINT NOT NULL,
 updated_us BIGINT NOT NULL, PRIMARY KEY(tenant_id,conversation_id)
);
CREATE INDEX ix_conversation_owner ON conversation(tenant_id,owner_id,status,updated_us,conversation_id);
CREATE TABLE conversation_message (
 tenant_id BIGINT NOT NULL, conversation_id BIGINT NOT NULL, message_id BIGINT NOT NULL,
 parent_message_id BIGINT, branch_id BIGINT NOT NULL, seq_no BIGINT NOT NULL CHECK(seq_no>=0),
 role VARCHAR(16) NOT NULL CHECK(role IN ('user','assistant','system','tool')),
 body TEXT NOT NULL, state VARCHAR(16) NOT NULL CHECK(state IN ('pending','streaming','complete','failed','deleted')),
 client_request_id VARCHAR(100) NOT NULL, created_us BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,conversation_id,message_id),
 UNIQUE(tenant_id,conversation_id,branch_id,seq_no),
 UNIQUE(tenant_id,conversation_id,client_request_id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversation(tenant_id,conversation_id),
 FOREIGN KEY(tenant_id,conversation_id,parent_message_id) REFERENCES conversation_message(tenant_id,conversation_id,message_id)
);
CREATE INDEX ix_message_branch ON conversation_message(tenant_id,conversation_id,branch_id,seq_no,message_id);
CREATE TABLE generation_run (
 tenant_id BIGINT NOT NULL, conversation_id BIGINT NOT NULL, run_id BIGINT NOT NULL,
 output_message_id BIGINT NOT NULL, model_version VARCHAR(100) NOT NULL,
 state VARCHAR(16) NOT NULL, last_chunk_seq BIGINT NOT NULL CHECK(last_chunk_seq>=-1),
 version BIGINT NOT NULL CHECK(version>=0), PRIMARY KEY(tenant_id,conversation_id,run_id),
 FOREIGN KEY(tenant_id,conversation_id,output_message_id) REFERENCES conversation_message(tenant_id,conversation_id,message_id)
);
-- Bind tenant/owner from authenticated identity; never trust an opaque ID as authorization.
SELECT conversation_id,title,updated_us FROM conversation
 WHERE tenant_id=? AND owner_id=? AND status='active'
 ORDER BY updated_us DESC,conversation_id DESC LIMIT ?;
SELECT message_id,parent_message_id,role,body,state,seq_no FROM conversation_message
 WHERE tenant_id=? AND conversation_id=? AND branch_id=? AND seq_no>?
 ORDER BY seq_no,message_id LIMIT ?;
