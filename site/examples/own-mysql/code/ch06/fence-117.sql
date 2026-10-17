-- One class per student; one recorded score per subject. NULL means not yet graded.
CREATE TABLE s(student_id BIGINT NOT NULL,subject VARCHAR(40) NOT NULL,score DECIMAL(5,2),PRIMARY KEY(student_id,subject));
CREATE TABLE c(student_id BIGINT PRIMARY KEY,class VARCHAR(40) NOT NULL);
INSERT INTO c VALUES(1,'A'),(2,'A'),(3,'B'),(4,'B'),(5,'C');
INSERT INTO s VALUES(1,'Math',80),(1,'English',90),(2,'Math',90),(2,'English',90),(3,'Math',100),(4,'Math',NULL);
SELECT COUNT(*) AS student_count FROM
 (SELECT student_id FROM s GROUP BY student_id HAVING AVG(score)<90) AS low_average;
-- Expected: 1. AVG ignores NULL; no-score students are not implicitly scored zero.
SELECT c.class,COALESCE(SUM(s.score),0) AS class_total
FROM c LEFT JOIN s ON s.student_id=c.student_id
GROUP BY c.class ORDER BY c.class;
-- Expected: (A,350),(B,100),(C,0).
