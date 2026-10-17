-- Fresh teaching schema. Value queries are also portable relational references.
CREATE TABLE null_probe(id BIGINT PRIMARY KEY,x INT);
CREATE INDEX ix_null_x ON null_probe(x);
INSERT INTO null_probe VALUES(1,NULL),(2,0),(3,1),(4,NULL);
SELECT id FROM null_probe WHERE x IS NULL ORDER BY id;
-- Expected: 1,4.
SELECT id FROM null_probe WHERE x = NULL ORDER BY id;
-- Expected: no rows.
SELECT id FROM null_probe WHERE x IS NOT NULL ORDER BY id;
-- Expected: 2,3.
-- MySQL-only plan/NULL-safe equality probes, run separately on MySQL:
-- EXPLAIN SELECT id FROM null_probe WHERE x IS NULL;
-- EXPLAIN SELECT id FROM null_probe WHERE x=1 OR x IS NULL;
-- SELECT id FROM null_probe WHERE x <=> NULL ORDER BY id;
