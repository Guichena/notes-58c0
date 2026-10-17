-- A separate toy page dataset is populated by tests to expose duplicate B values.
CREATE TABLE page_probe(id INTEGER PRIMARY KEY,a VARCHAR(30),b INTEGER NOT NULL);
CREATE INDEX ix_b_id ON page_probe(b,id);
CREATE TABLE page_digit(n INT PRIMARY KEY);
INSERT INTO page_digit VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9);
INSERT INTO page_probe(id,a,b)
SELECT n+1,CONCAT('row-',n+1),FLOOR(n/3)
FROM(SELECT a.n+10*b.n+100*c.n+1000*d.n n FROM page_digit a
 CROSS JOIN page_digit b CROSS JOIN page_digit c CROSS JOIN page_digit d)s WHERE n<1119;
-- Intended original syntax is LIMIT 10 OFFSET 1000000, with a specified order.
-- Here LIMIT 10 OFFSET 1000 keeps the fixture small; it is not a million-row benchmark.
SELECT id,a,b FROM page_probe WHERE b>10 ORDER BY b,id LIMIT 10 OFFSET 1000;
SELECT p.id,p.a,p.b FROM page_probe p JOIN
 (SELECT id,b FROM page_probe WHERE b>10 ORDER BY b,id LIMIT 10 OFFSET 1000) s
 ON p.id=s.id ORDER BY s.b,s.id;
-- For a cursor (last_b,last_id), bind values rather than concatenate them:
-- SELECT id,a,b FROM page_probe WHERE b>10
-- AND (b>? OR (b=? AND id>?)) ORDER BY b,id LIMIT 10;

SELECT id,a,b FROM page_probe WHERE b>10
 AND(b>344 OR(b=344 AND id>1033)) ORDER BY b,id LIMIT 10;
