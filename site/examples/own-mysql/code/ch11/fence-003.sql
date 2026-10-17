-- MySQL 8.4.0; fresh test schema. Plans below are to be observed, not asserted.
CREATE TABLE index_probe (
 id BIGINT PRIMARY KEY, a INT NOT NULL, b INT NOT NULL, c INT NOT NULL,
 payload VARCHAR(100) NOT NULL,
 KEY ix_abc(a,b,c), KEY ix_a(a), KEY ix_b(b)
) ENGINE=InnoDB;
INSERT INTO index_probe VALUES
 (1,3,2,1,'excluded'),(2,3,3,0,'excluded'),(3,3,3,1,'match'),
 (4,3,4,0,'excluded'),(5,3,4,1,'match'),(6,4,3,1,'excluded');
EXPLAIN FORMAT=JSON SELECT * FROM index_probe WHERE c=1 AND b>2 AND a=3;
SELECT id FROM index_probe WHERE c=1 AND b>2 AND a=3 ORDER BY id;
-- Expected values: 3,5. Predicate order does not change those values.
SELECT id FROM index_probe WHERE a=3 AND b>2 AND c=1 ORDER BY id;
EXPLAIN FORMAT=JSON SELECT * FROM index_probe IGNORE INDEX(ix_abc)
 WHERE b=2 AND a=3;
-- Compare an alternative compound order for the specific range predicate.
CREATE INDEX ix_acb ON index_probe(a,c,b);
EXPLAIN FORMAT=JSON SELECT * FROM index_probe WHERE a=3 AND c=1 AND b>2;
-- Tiny data can favor a table scan. Production-scale performance requires
-- controlled larger data distributions and safe EXPLAIN ANALYZE measurements.
