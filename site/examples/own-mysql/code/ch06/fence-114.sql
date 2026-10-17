CREATE TABLE name_rows(id BIGINT PRIMARY KEY,name VARCHAR(100),payload VARCHAR(100));
INSERT INTO name_rows VALUES(1,'A','a1'),(2,'A','a2'),(3,'B','b1'),(4,'B','b2'),(5,'B','b3'),
 (6,'C','only'),(7,NULL,'n1'),(8,NULL,'n2');
-- Names/counts only, including the NULL group; COUNT(name) would count zero there.
SELECT name,COUNT(*) AS cnt FROM name_rows GROUP BY name HAVING COUNT(*)>=2;
-- All original rows, MySQL8+ window variant. Nulls are partitioned together.
WITH marked AS (
 SELECT id,name,payload,COUNT(*) OVER(PARTITION BY name) AS cnt FROM name_rows
)
SELECT id,name,payload FROM marked WHERE cnt>=2 ORDER BY id;
-- Portable grouped join variant if windows are unavailable:
SELECT r.id,r.name,r.payload FROM name_rows r JOIN
 (SELECT name FROM name_rows GROUP BY name HAVING COUNT(*)>=2) d
 ON r.name=d.name OR (r.name IS NULL AND d.name IS NULL) ORDER BY r.id;
