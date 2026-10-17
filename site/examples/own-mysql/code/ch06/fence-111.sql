-- MySQL 8 / SQLite value semantics; choose MAX only after defining duplicate policy.
CREATE TABLE source_scores(id BIGINT NOT NULL,score DECIMAL(8,2),type INTEGER NOT NULL);
INSERT INTO source_scores VALUES(1,80,1),(1,90,2),(1,70,3),(2,0,1),(2,NULL,2),(3,50,3);
SELECT id,
 MAX(CASE WHEN type=1 THEN score END) AS score_1,
 MAX(CASE WHEN type=2 THEN score END) AS score_2,
 MAX(CASE WHEN type=3 THEN score END) AS score_3
FROM source_scores WHERE type IN (1,2,3) GROUP BY id ORDER BY id;
-- Missing/NULL scores remain NULL; a valid zero score remains zero.
-- If one score per (id,type) is the business rule, enforce UNIQUE(id,type)
-- after finding/reconciling duplicates. MAX is not a duplicate-repair policy.
