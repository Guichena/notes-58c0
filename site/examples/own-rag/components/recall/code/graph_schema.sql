-- PostgreSQL 16 自足教学脚本；未连接数据库运行。
-- 在独立测试会话运行；只建立临时表，ROLLBACK 后不保留。
BEGIN;
CREATE TEMP TABLE kg_node (
 tenant_id BIGINT NOT NULL CHECK(tenant_id>0), generation BIGINT NOT NULL CHECK(generation>=0),
 node_id VARCHAR(100) NOT NULL, node_type VARCHAR(50) NOT NULL, label VARCHAR(200) NOT NULL,
 PRIMARY KEY(tenant_id,generation,node_id));
CREATE TEMP TABLE kg_alias (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, normalized_alias VARCHAR(256) NOT NULL,
 node_id VARCHAR(100) NOT NULL, PRIMARY KEY(tenant_id,generation,normalized_alias,node_id),
 FOREIGN KEY(tenant_id,generation,node_id) REFERENCES kg_node);
CREATE TEMP TABLE kg_node_grant (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, principal VARCHAR(100) NOT NULL,
 node_id VARCHAR(100) NOT NULL, PRIMARY KEY(tenant_id,generation,principal,node_id),
 FOREIGN KEY(tenant_id,generation,node_id) REFERENCES kg_node);
CREATE TEMP TABLE kg_evidence (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, evidence_id VARCHAR(100) NOT NULL,
 source_id VARCHAR(100) NOT NULL, source_version VARCHAR(100) NOT NULL,
 locator TEXT NOT NULL, active BOOLEAN NOT NULL,
 PRIMARY KEY(tenant_id,generation,evidence_id));
CREATE TEMP TABLE kg_evidence_grant (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, principal VARCHAR(100) NOT NULL,
 evidence_id VARCHAR(100) NOT NULL, PRIMARY KEY(tenant_id,generation,principal,evidence_id),
 FOREIGN KEY(tenant_id,generation,evidence_id) REFERENCES kg_evidence);
CREATE TEMP TABLE kg_edge (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, edge_id VARCHAR(100) NOT NULL,
 subject_id VARCHAR(100) NOT NULL, predicate VARCHAR(100) NOT NULL, object_id VARCHAR(100) NOT NULL,
 polarity SMALLINT NOT NULL CHECK(polarity IN (-1,1)),
 qualifiers JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(qualifiers)='object'),
 valid_from BIGINT NOT NULL, valid_to BIGINT NOT NULL CHECK(valid_from<valid_to),
 PRIMARY KEY(tenant_id,generation,edge_id),
 FOREIGN KEY(tenant_id,generation,subject_id) REFERENCES kg_node,
 FOREIGN KEY(tenant_id,generation,object_id) REFERENCES kg_node);
CREATE TEMP TABLE kg_edge_evidence (
 tenant_id BIGINT NOT NULL, generation BIGINT NOT NULL, edge_id VARCHAR(100) NOT NULL,
 evidence_id VARCHAR(100) NOT NULL,
 confidence DOUBLE PRECISION NOT NULL CHECK(confidence>=0 AND confidence<=1),
 PRIMARY KEY(tenant_id,generation,edge_id,evidence_id),
 FOREIGN KEY(tenant_id,generation,edge_id) REFERENCES kg_edge,
 FOREIGN KEY(tenant_id,generation,evidence_id) REFERENCES kg_evidence);
CREATE INDEX ix_kg_forward ON kg_edge(tenant_id,generation,subject_id,predicate,object_id);
CREATE INDEX ix_kg_reverse ON kg_edge(tenant_id,generation,object_id,predicate,subject_id);

INSERT INTO kg_node VALUES (1,7,'t1','Teacher','王老师'),(1,7,'t2','Teacher','王老师'),
 (1,7,'c1','Course','数据库'),(1,7,'r1','Room','A101'),(2,7,'t1','Teacher','其他租户');
INSERT INTO kg_alias VALUES (1,7,'王老师','t1'),(1,7,'王老师','t2'),(2,7,'王老师','t1');
INSERT INTO kg_node_grant VALUES (1,7,'alice','t1'),(1,7,'alice','t2'),
 (1,7,'alice','c1'),(1,7,'alice','r1');
INSERT INTO kg_evidence VALUES (1,7,'e1','schedule','v2','page=1;lines=2-3',true),
 (1,7,'e2','timetable','v3','page=2;row=5',true),
 (1,7,'secret','private-schedule','v1','page=9',true);
INSERT INTO kg_evidence_grant VALUES (1,7,'alice','e1'),(1,7,'alice','e2');
INSERT INTO kg_edge VALUES
 (1,7,'f1','t1','TEACHES','c1',1,'{"term":"2026-autumn"}',0,100),
 (1,7,'f2','c1','LOCATED_IN','r1',1,'{"term":"2026-autumn"}',0,100),
 (1,7,'f3','t2','TEACHES','c1',1,'{"term":"2026-autumn"}',0,100);
INSERT INTO kg_edge_evidence VALUES (1,7,'f1','e1',.9),(1,7,'f1','e2',.8),
 (1,7,'f2','e2',.9),(1,7,'f3','secret',1);

-- 参数：租户、代次、规范化别名、可信 principal、候选上限。
PREPARE graph_alias(BIGINT,BIGINT,TEXT,TEXT,INTEGER) AS
 SELECT n.node_id,n.node_type,n.label FROM kg_alias a JOIN kg_node n
 ON (n.tenant_id,n.generation,n.node_id)=(a.tenant_id,a.generation,a.node_id)
 WHERE a.tenant_id=$1 AND a.generation=$2 AND a.normalized_alias=$3
 AND EXISTS(SELECT 1 FROM kg_node_grant g WHERE
  (g.tenant_id,g.generation,g.node_id)=(n.tenant_id,n.generation,n.node_id) AND g.principal=$4)
 ORDER BY n.node_id LIMIT CASE WHEN $5 BETWEEN 1 AND 100 THEN $5 ELSE 0 END;

-- 参数：租户、代次、起点、白名单关系、可信 principal、查询时点、事实数上限。
-- 只检索肯定边；否定证据可用单独受控查询读取，不能当肯定关系继续推导。
PREPARE graph_expand(BIGINT,BIGINT,TEXT,TEXT,TEXT,BIGINT,INTEGER) AS
 SELECT e.edge_id,e.subject_id,e.predicate,e.object_id,e.qualifiers,
  array_agg(v.evidence_id ORDER BY v.evidence_id) AS authorized_evidence,
  max(s.confidence) AS ranking_confidence
 FROM kg_edge e JOIN kg_edge_evidence s USING(tenant_id,generation,edge_id)
 JOIN kg_evidence v USING(tenant_id,generation,evidence_id)
 WHERE e.tenant_id=$1 AND e.generation=$2 AND e.subject_id=$3 AND e.predicate=$4
 AND e.polarity=1 AND e.valid_from<=$6 AND e.valid_to>$6 AND v.active
 AND EXISTS(SELECT 1 FROM kg_node_grant g WHERE
  (g.tenant_id,g.generation,g.node_id)=(e.tenant_id,e.generation,e.subject_id) AND g.principal=$5)
 AND EXISTS(SELECT 1 FROM kg_node_grant g WHERE
  (g.tenant_id,g.generation,g.node_id)=(e.tenant_id,e.generation,e.object_id) AND g.principal=$5)
 AND EXISTS(SELECT 1 FROM kg_evidence_grant g WHERE
  (g.tenant_id,g.generation,g.evidence_id)=(v.tenant_id,v.generation,v.evidence_id) AND g.principal=$5)
 GROUP BY e.tenant_id,e.generation,e.edge_id,e.subject_id,e.predicate,e.object_id,e.qualifiers
 ORDER BY ranking_confidence DESC,e.edge_id
 LIMIT CASE WHEN $7 BETWEEN 1 AND 100 THEN $7 ELSE 0 END;

EXECUTE graph_alias(1,7,'王老师','alice',10); -- 两候选，不能擅自合并。
EXECUTE graph_expand(1,7,'t1','TEACHES','alice',50,10); -- f1，保留 e1/e2。
EXECUTE graph_expand(1,7,'t2','TEACHES','alice',50,10); -- 秘密证据不应返回。
EXECUTE graph_expand(1,7,'t1','TEACHES','alice',100,10); -- 半开区间上界，无结果。
EXECUTE graph_alias(2,7,'王老师','alice',10); -- 无授权，无结果。
DELETE FROM kg_evidence_grant WHERE principal='alice' AND evidence_id='e1';
EXECUTE graph_expand(1,7,'t1','TEACHES','alice',50,10); -- 仍有 e2。
DELETE FROM kg_evidence_grant WHERE principal='alice' AND evidence_id='e2';
EXECUTE graph_expand(1,7,'t1','TEACHES','alice',50,10); -- 最后一份依据不可见，无结果。
DEALLOCATE graph_alias;
DEALLOCATE graph_expand;
ROLLBACK;
