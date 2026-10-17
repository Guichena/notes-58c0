-- Independent registry, NOT a generic execution engine for arbitrary Excel SQL.
CREATE TABLE kb_document(
 tenant_id BIGINT NOT NULL,doc_id BIGINT NOT NULL,revision BIGINT NOT NULL,
 source_uri VARCHAR(500) NOT NULL,content_hash VARCHAR(64) NOT NULL,acl_version BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,doc_id,revision));
CREATE TABLE kb_acl(
 tenant_id BIGINT NOT NULL,doc_id BIGINT NOT NULL,revision BIGINT NOT NULL,principal_id BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,doc_id,revision,principal_id),
 FOREIGN KEY(tenant_id,doc_id,revision) REFERENCES kb_document(tenant_id,doc_id,revision));
CREATE TABLE kb_table(
 tenant_id BIGINT NOT NULL,doc_id BIGINT NOT NULL,revision BIGINT NOT NULL,table_id BIGINT NOT NULL,
 title VARCHAR(120) NOT NULL,schema_json TEXT NOT NULL,row_count BIGINT NOT NULL CHECK(row_count>=0),
 PRIMARY KEY(tenant_id,doc_id,revision,table_id),
 FOREIGN KEY(tenant_id,doc_id,revision) REFERENCES kb_document(tenant_id,doc_id,revision));
CREATE TABLE kb_chunk(
 tenant_id BIGINT NOT NULL,doc_id BIGINT NOT NULL,revision BIGINT NOT NULL,chunk_id BIGINT NOT NULL,
 table_id BIGINT,row_start INT,row_end INT,text_value TEXT NOT NULL,content_hash VARCHAR(64) NOT NULL,
 PRIMARY KEY(tenant_id,doc_id,revision,chunk_id),
 CHECK((table_id IS NULL AND row_start IS NULL AND row_end IS NULL)
   OR (table_id IS NOT NULL AND row_start IS NOT NULL AND row_end IS NOT NULL AND row_start>=0 AND row_end>=row_start)),
 FOREIGN KEY(tenant_id,doc_id,revision) REFERENCES kb_document(tenant_id,doc_id,revision),
 FOREIGN KEY(tenant_id,doc_id,revision,table_id) REFERENCES kb_table(tenant_id,doc_id,revision,table_id));
CREATE INDEX ix_chunk_table ON kb_chunk(tenant_id,doc_id,revision,table_id,row_start);
CREATE TABLE kb_relation(
 tenant_id BIGINT NOT NULL,doc_id BIGINT NOT NULL,revision BIGINT NOT NULL,relation_id BIGINT NOT NULL,
 left_table BIGINT NOT NULL,right_table BIGINT NOT NULL,left_column VARCHAR(80) NOT NULL,right_column VARCHAR(80) NOT NULL,
 cardinality VARCHAR(10) NOT NULL,verified INT NOT NULL CHECK(verified IN(0,1)),source_position VARCHAR(200) NOT NULL,
 PRIMARY KEY(tenant_id,doc_id,revision,relation_id),
 FOREIGN KEY(tenant_id,doc_id,revision,left_table) REFERENCES kb_table(tenant_id,doc_id,revision,table_id),
 FOREIGN KEY(tenant_id,doc_id,revision,right_table) REFERENCES kb_table(tenant_id,doc_id,revision,table_id));
CREATE INDEX ix_relation_left ON kb_relation(tenant_id,doc_id,revision,left_table);
-- Model-selected table/chunk IDs never bypass trusted tenant/principal parameters.
-- Application also rechecks current ACL/version; this example only shows persisted grants.
SELECT ch.chunk_id,ch.text_value FROM kb_chunk ch
JOIN kb_acl a ON a.tenant_id=ch.tenant_id AND a.doc_id=ch.doc_id AND a.revision=ch.revision
WHERE ch.tenant_id=? AND a.principal_id=? AND ch.doc_id=? AND ch.revision=? AND ch.table_id=?
ORDER BY ch.row_start,ch.chunk_id LIMIT 20;
