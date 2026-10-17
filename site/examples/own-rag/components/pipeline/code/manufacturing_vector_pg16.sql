-- PostgreSQL 16 + installed pgvector 0.8.2, disposable database, TEMP privilege.
-- Complete synthetic counterpart of the parameterized SOP/CASE vector query.
-- No real equipment data, model embeddings, production schema, RLS guarantee or measured recall.
BEGIN;
DO $$ BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 160000 AND 169999 THEN
  RAISE EXCEPTION 'requires PostgreSQL 16'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector' AND extversion='0.8.2') THEN
  RAISE EXCEPTION 'requires installed pgvector 0.8.2'; END IF;
END $$;
CREATE TEMP TABLE teaching_knowledge_chunk(
 tenant_id bigint NOT NULL,index_build_id bigint NOT NULL,id text NOT NULL,
 source_id text NOT NULL,source_version text NOT NULL,doc_type text NOT NULL,
 device_model text NOT NULL,alarm_code text NOT NULL,projected_status text NOT NULL,
 valid_from bigint NOT NULL,valid_to bigint NOT NULL,embedding vector(3) NOT NULL,
 PRIMARY KEY(tenant_id,index_build_id,id),CHECK(valid_from<valid_to),
 CHECK(doc_type IN ('SOP','CASE')),CHECK(projected_status IN ('EFFECTIVE','RETIRED')));
CREATE TEMP TABLE teaching_grant(
 tenant_id bigint NOT NULL,index_build_id bigint NOT NULL,id text NOT NULL,principal text NOT NULL,
 PRIMARY KEY(tenant_id,index_build_id,id,principal),
 FOREIGN KEY(tenant_id,index_build_id,id) REFERENCES teaching_knowledge_chunk);
INSERT INTO teaching_knowledge_chunk VALUES
 (1,7,'s1','sop-a','v2','SOP','KQL-200','E-101','EFFECTIVE',0,100,'[1,0,0]'),
 (1,7,'s2','sop-b','v1','SOP','KQL-201','E-101','EFFECTIVE',0,100,'[1,0.01,0]'),
 (1,7,'s3','sop-c','v1','SOP','KQL-200','E-101','EFFECTIVE',0,100,'[1,0.02,0]'),
 (1,7,'c1','case-a','v1','CASE','KQL-200','E-101','EFFECTIVE',0,100,'[0.9,0.1,0]'),
 (2,7,'s1','other','v1','SOP','KQL-200','E-101','EFFECTIVE',0,100,'[1,0,0]');
INSERT INTO teaching_grant VALUES(1,7,'s1','alice'),(1,7,'s2','alice'),(1,7,'c1','alice'),(2,7,'s1','alice');
CREATE INDEX teaching_filter ON teaching_knowledge_chunk(tenant_id,index_build_id,doc_type,device_model,alarm_code);
CREATE INDEX teaching_ann ON teaching_knowledge_chunk USING hnsw(embedding vector_cosine_ops)
 WITH(m=16,ef_construction=64);
SET LOCAL statement_timeout='2s';
SET LOCAL hnsw.ef_search=100;
SET LOCAL hnsw.iterative_scan='strict_order';
SET LOCAL hnsw.max_scan_tuples=1000;
-- Trusted service supplies tenant, build, type, model, optional alarm, principal,
-- business time, same-space query vector and candidate limit. Bind, never concatenate.
PREPARE teaching_vector(bigint,bigint,text,text,text,text,bigint,vector,integer) AS
 SELECT c.id,c.source_id,c.source_version,c.embedding <=> $8 AS distance
 FROM teaching_knowledge_chunk c
 WHERE c.tenant_id=$1 AND c.index_build_id=$2 AND c.doc_type=$3 AND c.device_model=$4
 AND ($5 IS NULL OR c.alarm_code=$5) AND c.projected_status='EFFECTIVE'
 AND c.valid_from<=$7 AND c.valid_to>$7
 AND EXISTS(SELECT 1 FROM teaching_grant g WHERE
  (g.tenant_id,g.index_build_id,g.id)=(c.tenant_id,c.index_build_id,c.id) AND g.principal=$6)
 ORDER BY c.embedding <=> $8 LIMIT CASE WHEN $9 BETWEEN 1 AND 100 THEN $9 ELSE 0 END;
EXECUTE teaching_vector(1,7,'SOP','KQL-200','E-101','alice',50,'[1,0,0]',20);
EXECUTE teaching_vector(1,7,'CASE','KQL-200','E-101','alice',50,'[1,0,0]',20);
EXECUTE teaching_vector(1,7,'SOP','KQL-200','E-101','alice',100,'[1,0,0]',20);
EXPLAIN(ANALYZE,BUFFERS) EXECUTE teaching_vector(1,7,'SOP','KQL-200','E-101','alice',50,'[1,0,0]',20);
-- Same predicate, materialized full-distance reference. Small data may not use ANN at all.
WITH eligible AS MATERIALIZED(
 SELECT c.* FROM teaching_knowledge_chunk c
 WHERE c.tenant_id=1 AND c.index_build_id=7 AND c.doc_type='SOP' AND c.device_model='KQL-200'
 AND c.alarm_code='E-101' AND c.projected_status='EFFECTIVE' AND c.valid_from<=50 AND c.valid_to>50
 AND EXISTS(SELECT 1 FROM teaching_grant g WHERE
  (g.tenant_id,g.index_build_id,g.id)=(c.tenant_id,c.index_build_id,c.id) AND g.principal='alice')
) SELECT id,embedding <=> '[1,0,0]'::vector AS distance FROM eligible ORDER BY distance,id LIMIT 20;
-- Before prompting, re-read authoritative SOP/CASE version, grants, applicability and source text.
-- This projection and SQL predicate do not create a cross-system transaction or identify root cause.
DEALLOCATE teaching_vector;
ROLLBACK;
