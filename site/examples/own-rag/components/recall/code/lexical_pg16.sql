-- PostgreSQL 16 自足教学脚本；未连接数据库运行。
-- 预分词示例，不是中文分词器实现；没有 pgvector、生产 ACL 或事实主库。
BEGIN;
CREATE TEMP TABLE recall_chunk (
 tenant_id BIGINT NOT NULL, index_build_id BIGINT NOT NULL, id TEXT NOT NULL,
 source_id TEXT NOT NULL, source_version TEXT NOT NULL, doc_type TEXT NOT NULL,
 device_model TEXT NOT NULL, alarm_code TEXT NOT NULL,
 projected_status TEXT NOT NULL, valid_from BIGINT NOT NULL, valid_to BIGINT NOT NULL,
 keyword_tokens TEXT NOT NULL, body TEXT NOT NULL,
 tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,keyword_tokens)) STORED,
 PRIMARY KEY(tenant_id,index_build_id,id), CHECK(valid_from<valid_to),
 CHECK(doc_type IN ('SOP','CASE')), CHECK(projected_status IN ('EFFECTIVE','RETIRED')));
CREATE TEMP TABLE recall_grant (
 tenant_id BIGINT NOT NULL, index_build_id BIGINT NOT NULL, id TEXT NOT NULL,
 principal TEXT NOT NULL, PRIMARY KEY(tenant_id,index_build_id,id,principal),
 FOREIGN KEY(tenant_id,index_build_id,id) REFERENCES recall_chunk);
CREATE INDEX recall_tsv ON recall_chunk USING GIN(tsv);
CREATE INDEX recall_exact ON recall_chunk(tenant_id,index_build_id,doc_type,device_model,alarm_code);
INSERT INTO recall_chunk(tenant_id,index_build_id,id,source_id,source_version,doc_type,
 device_model,alarm_code,projected_status,valid_from,valid_to,keyword_tokens,body) VALUES
 (1,7,'s1','sop-a','v2','SOP','KQL-200','E-101','EFFECTIVE',0,100,'出口温度高 冷却水','教学文本一'),
 (1,7,'s2','sop-b','v1','SOP','KQL-200','E-101','EFFECTIVE',0,100,'换热','教学文本二'),
 (1,7,'s3','sop-c','v1','SOP','KQL-201','E-101','EFFECTIVE',0,100,'出口温度高 冷却水','其他型号'),
 (1,7,'s4','sop-d','v1','SOP','KQL-200','E-101','EFFECTIVE',0,100,'出口温度高 冷却水','未授权'),
 (1,7,'c1','case-a','v1','CASE','KQL-200','E-101','EFFECTIVE',0,100,'温度 上升 声音 发闷','历史案例');
INSERT INTO recall_grant VALUES (1,7,'s1','alice'),(1,7,'s2','alice'),
 (1,7,'s3','alice'),(1,7,'c1','alice');
-- recall_exact 参数：租户、代次、类型、型号、告警码、可信 principal、时点、上限。
-- 告警码为 NULL 表示用户未提供，不能由模型把已知编码改成 NULL 来扩大范围。
PREPARE recall_exact(BIGINT,BIGINT,TEXT,TEXT,TEXT,TEXT,BIGINT,INTEGER) AS
 SELECT c.id,c.source_id,c.source_version FROM recall_chunk c
 WHERE c.tenant_id=$1 AND c.index_build_id=$2 AND c.doc_type=$3 AND c.device_model=$4
 AND $5 IS NOT NULL AND c.alarm_code=$5 AND c.projected_status='EFFECTIVE'
 AND c.valid_from<=$7 AND c.valid_to>$7
 AND EXISTS(SELECT 1 FROM recall_grant g WHERE
  (g.tenant_id,g.index_build_id,g.id)=(c.tenant_id,c.index_build_id,c.id) AND g.principal=$6)
 ORDER BY c.id LIMIT CASE WHEN $8 BETWEEN 1 AND 100 THEN $8 ELSE 0 END;
-- recall_keywords 参数：租户、代次、类型、型号、可选告警码、可信 principal、时点、查询文本、上限。
PREPARE recall_keywords(BIGINT,BIGINT,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,INTEGER) AS
 WITH q AS (SELECT websearch_to_tsquery('simple',$8) AS query)
 SELECT c.id,c.source_id,c.source_version,ts_rank(c.tsv,q.query) AS score
 FROM recall_chunk c CROSS JOIN q
 WHERE c.tenant_id=$1 AND c.index_build_id=$2 AND c.doc_type=$3 AND c.device_model=$4
 AND ($5 IS NULL OR c.alarm_code=$5) AND c.projected_status='EFFECTIVE'
 AND c.valid_from<=$7 AND c.valid_to>$7 AND numnode(q.query)>0 AND c.tsv@@q.query
 AND EXISTS(SELECT 1 FROM recall_grant g WHERE
  (g.tenant_id,g.index_build_id,g.id)=(c.tenant_id,c.index_build_id,c.id) AND g.principal=$6)
 ORDER BY score DESC,c.id LIMIT CASE WHEN $9 BETWEEN 1 AND 100 THEN $9 ELSE 0 END;
SELECT * FROM ts_debug('simple','出口温度高 冷却水 E-101 KQL-200');
SELECT plainto_tsquery('simple','出口温度高 冷却水') AS all_terms,
 websearch_to_tsquery('simple','出口温度高 OR 冷却水 OR 换热') AS any_terms;
EXECUTE recall_exact(1,7,'SOP','KQL-200','E-101','alice',50,20);
EXECUTE recall_keywords(1,7,'SOP','KQL-200','E-101','alice',50,'出口温度高 OR 冷却水 OR 换热',20);
EXECUTE recall_keywords(1,7,'SOP','KQL-200','E-101','alice',50,'出口温度高 冷却水',20);
EXECUTE recall_keywords(1,7,'SOP','KQL-200','E-101','alice',100,'冷却水',20);
EXECUTE recall_keywords(1,7,'CASE','KQL-200','E-101','alice',50,'声音 发闷',20);
DEALLOCATE recall_exact;
DEALLOCATE recall_keywords;
ROLLBACK;
