-- Relational boundary fixtures; observe plans separately.
CREATE TABLE range_probe(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER);
CREATE INDEX ix_abc ON range_probe(a,b,c);
INSERT INTO range_probe VALUES(1,10,100,99),(2,10,101,40),(3,10,101,60),
 (4,10,102,30),(5,10,102,70),(6,11,101,80),(7,10,103,NULL);
SELECT id FROM range_probe WHERE a=10 AND b>100 AND c>50 ORDER BY id;
-- Expected: 3,5. C filters holes inside the A/B range.
