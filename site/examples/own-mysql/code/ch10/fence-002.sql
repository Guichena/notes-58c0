-- MySQL 8.4.0，在空实验 schema 中执行；同名表存在时请换 schema。
CREATE TABLE idx_students (
  id BIGINT PRIMARY KEY,
  age INT NOT NULL,
  name VARCHAR(40) NOT NULL,
  KEY ix_age (age)
) ENGINE=InnoDB;
INSERT INTO idx_students VALUES (1,1,'Ada'),(2,1,'Lin'),(3,2,'Mo');
-- 小表可能自然选择全表扫描；FORCE仅用于观察指定路径。
EXPLAIN SELECT id,age,name FROM idx_students FORCE INDEX(ix_age) WHERE age=1;
SELECT id,age,name FROM idx_students WHERE age=1;
EXPLAIN SELECT id,age FROM idx_students FORCE INDEX(ix_age) WHERE age=1;
SELECT id,age FROM idx_students WHERE age=1;
