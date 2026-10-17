-- PostgreSQL 16 + pgvector 0.8.2. Educational integration script, NOT run here.
-- Prerequisites: extension vector 0.8.2 already installed in a disposable PG16 database.
-- Use psql -X -v ON_ERROR_STOP=1 -f pgvector_pg16.sql with a non-superuser,
-- non-BYPASSRLS role that can create TEMP tables. No password in this file.
-- Temporary fixture objects and changes are rolled back at the end.
BEGIN;
DO $$
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 160000 AND 169999 THEN
  RAISE EXCEPTION 'requires PostgreSQL 16';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector' AND extversion='0.8.2') THEN
  RAISE EXCEPTION 'requires installed pgvector 0.8.2';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'RLS demonstration must not use superuser or BYPASSRLS';
 END IF;
END $$;
CREATE TEMP TABLE demo_vector_chunk(
 tenant_id bigint NOT NULL CHECK(tenant_id>0), generation bigint NOT NULL,
 chunk_id bigint NOT NULL, source_id text NOT NULL, revision text NOT NULL,
 body text NOT NULL, embedding vector(3) NOT NULL,
 PRIMARY KEY(tenant_id,generation,chunk_id));
CREATE TEMP TABLE demo_vector_grant(
 tenant_id bigint NOT NULL, generation bigint NOT NULL, chunk_id bigint NOT NULL,
 principal text NOT NULL, PRIMARY KEY(tenant_id,generation,chunk_id,principal),
 FOREIGN KEY(tenant_id,generation,chunk_id) REFERENCES demo_vector_chunk);
INSERT INTO demo_vector_chunk VALUES
 (1,7,1,'a','v1','authorized aligned','[1,0,0]'),
 (1,7,2,'b','v1','authorized orthogonal','[0,1,0]'),
 (1,7,3,'c','v1','not authorized','[1,0.001,0]'),
 (2,7,1,'other','v1','other tenant','[1,0,0]'),
 (1,8,1,'a','v2','unpublished generation','[1,0,0]');
INSERT INTO demo_vector_grant VALUES
 (1,7,1,current_user),(1,7,2,current_user),(2,7,1,current_user),(1,8,1,current_user);
CREATE INDEX demo_vector_filter ON demo_vector_chunk(tenant_id,generation);
CREATE INDEX demo_vector_ann ON demo_vector_chunk USING hnsw(embedding vector_cosine_ops)
 WITH(m=16,ef_construction=64);
ALTER TABLE demo_vector_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_vector_chunk FORCE ROW LEVEL SECURITY;
CREATE POLICY demo_read_policy ON demo_vector_chunk FOR SELECT USING(
 tenant_id=nullif(current_setting('demo.tenant',true),'')::bigint
 AND EXISTS(SELECT 1 FROM demo_vector_grant g
 WHERE (g.tenant_id,g.generation,g.chunk_id)=
       (demo_vector_chunk.tenant_id,demo_vector_chunk.generation,demo_vector_chunk.chunk_id)
 AND g.principal=current_user));
-- Trusted server sets this after authentication; arbitrary SQL clients could change it.
-- Thus this custom GUC is NOT itself a tenant-authentication boundary.
SET LOCAL demo.tenant='1';
SET LOCAL statement_timeout='2s';
SET LOCAL hnsw.ef_search=100;
SET LOCAL hnsw.iterative_scan='strict_order';
SET LOCAL hnsw.max_scan_tuples=1000;
SET LOCAL hnsw.scan_mem_multiplier=1;
ANALYZE demo_vector_chunk;
PREPARE demo_ann(bigint,bigint,vector,integer) AS
 SELECT chunk_id,source_id,revision,embedding <=> $3 AS cosine_distance
 FROM demo_vector_chunk WHERE tenant_id=$1 AND generation=$2
 ORDER BY embedding <=> $3 LIMIT CASE WHEN $4 BETWEEN 1 AND 100 THEN $4 ELSE 0 END;
EXECUTE demo_ann(1,7,'[1,0,0]',5);
-- Small fixtures may legitimately choose a sequential scan. Never claim ANN was used
-- merely because its index exists. Check the actual plan below.
EXPLAIN(ANALYZE,BUFFERS) EXECUTE demo_ann(1,7,'[1,0,0]',5);
-- A materialized eligible set is the same-filter full-distance baseline; the outer
-- query computes all eligible distances, independent of an ANN scan's exploration.
WITH eligible AS MATERIALIZED(
 SELECT * FROM demo_vector_chunk WHERE tenant_id=1 AND generation=7
) SELECT chunk_id,embedding <=> '[1,0,0]'::vector AS distance
 FROM eligible ORDER BY distance,chunk_id LIMIT 5;
DO $$
BEGIN
 IF (SELECT count(*) FROM demo_vector_chunk WHERE generation=7)<>2 THEN
  RAISE EXCEPTION 'tenant/current grants failed';
 END IF;
END $$;
DELETE FROM demo_vector_grant WHERE tenant_id=1 AND generation=7 AND chunk_id=1;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM demo_vector_chunk WHERE tenant_id=1 AND generation=7 AND chunk_id=1) THEN
  RAISE EXCEPTION 'grant revocation failed';
 END IF;
END $$;
DEALLOCATE demo_ann;
ROLLBACK;
