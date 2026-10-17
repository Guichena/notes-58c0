CREATE TABLE users_probe(id INTEGER PRIMARY KEY,username VARCHAR(100),gender VARCHAR(12),age INTEGER);
CREATE INDEX ix_gender_name ON users_probe(gender,username,id);
INSERT INTO users_probe VALUES(1,'王小红','F',20),(2,'王明','M',21),
 (3,'李王','F',30),(4,'王','F',40),(5,'王莉','F',NULL),(6,NULL,'F',25);
SELECT id FROM users_probe WHERE gender='F' AND username LIKE '王%' ORDER BY username,id;
