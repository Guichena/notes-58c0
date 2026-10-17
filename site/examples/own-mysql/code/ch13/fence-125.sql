-- MySQL demonstration. Run EXPLAIN / EXPLAIN ANALYZE for these SELECTs in a controlled MySQL instance.
CREATE TABLE index_users(id BIGINT PRIMARY KEY,status INT NOT NULL,age INT NOT NULL,payload VARCHAR(100));
CREATE INDEX ix_status_age ON index_users(status,age);
INSERT INTO index_users VALUES(1,0,12,'boundary'),(2,0,13,'yes'),(3,1,30,'wrong status'),(4,0,90,'yes'),(5,0,0,'young');
SELECT id,age FROM index_users WHERE status=0 AND age>12 ORDER BY id;
CREATE TABLE index_triplet(id BIGINT PRIMARY KEY,a INT,b INT,c INT,payload VARCHAR(20));
CREATE INDEX ix_abc ON index_triplet(a,b,c);
INSERT INTO index_triplet VALUES(1,5,1,10,'boundary'),(2,5,1,11,'yes'),(3,5,5,99,'yes'),(4,5,6,99,'wrong b'),(5,4,2,99,'wrong a'),(6,5,3,NULL,'null c'),(7,5,NULL,99,'null b'),(8,5,2,12,'yes');
SELECT id FROM index_triplet WHERE a=5 AND c>10 AND b IN(1,2,3,4,5) ORDER BY id;
SELECT id FROM index_triplet WHERE (a=5 AND b=1 AND c>10) OR (a=5 AND b=2 AND c>10)
 OR (a=5 AND b=3 AND c>10) OR (a=5 AND b=4 AND c>10) OR (a=5 AND b=5 AND c>10) ORDER BY id;
