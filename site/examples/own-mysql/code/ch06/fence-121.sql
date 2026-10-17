CREATE TABLE compare_a(business_id BIGINT,payload VARCHAR(100));
CREATE TABLE compare_b(business_id BIGINT,payload VARCHAR(100));
INSERT INTO compare_a VALUES(1,'old'),(2,NULL),(2,NULL);
INSERT INTO compare_b VALUES(1,'new'),(2,NULL),(3,'x'),(3,'x'),(4,'y');
-- B has two more rows, but five distinct value/count differences.
