CREATE TABLE top_items(id BIGINT PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER,d INTEGER,payload VARCHAR(100));
CREATE INDEX ix_b_a ON top_items(b,a);
CREATE INDEX ix_c_d_id ON top_items(c,d DESC,id DESC);
INSERT INTO top_items VALUES
 (1,8,2,9,100,'both'),(2,8,2,1,90,'P'),(3,NULL,2,9,80,'unknown P'),
 (4,1,2,9,80,'Q'),(5,8,NULL,9,70,'unknown P'),(6,8,2,NULL,70,'P'),
 (7,1,1,1,200,'neither'),(8,8,2,9,NULL,'both null sort'),
 (9,NULL,NULL,9,60,'Q'),(10,6,2,0,50,'P'),(11,9,2,0,40,'P'),
 (12,0,0,9,30,'Q'),(13,0,0,9,20,'Q'),(14,0,0,9,10,'Q');
SET @threshold=5; SET @bv=2; SET @cv=9;
-- Baseline useings: threshold, b_value, c_value.
SELECT * FROM top_items WHERE (a>@threshold AND b=@bv) OR c=@cv ORDER BY d DESC,id DESC LIMIT 10;
-- Equivalent disjoint branches. Use the same session values in both branches.
WITH first_ten AS (
 SELECT * FROM top_items WHERE a>@threshold AND b=@bv ORDER BY d DESC,id DESC LIMIT 10
), second_ten AS (
 SELECT * FROM top_items WHERE c=@cv AND (a>@threshold AND b=@bv) IS NOT TRUE ORDER BY d DESC,id DESC LIMIT 10
)
SELECT * FROM (SELECT * FROM first_ten UNION ALL SELECT * FROM second_ten) candidates
ORDER BY d DESC,id DESC LIMIT 10;
-- NOT(a>@threshold AND b=@bv) would drop UNKNOWN rows from the second branch: incorrect with NULL.
-- Candidate alternative, not a recommendation to create every index:
-- CREATE INDEX ix_b_d_id_a ON top_items(b,d DESC,id DESC,a);
-- CREATE INDEX ix_d_id ON top_items(d DESC,id DESC);
