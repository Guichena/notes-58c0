CREATE TABLE student (student_id BIGINT PRIMARY KEY, name VARCHAR(80) NOT NULL);
CREATE TABLE course (course_id BIGINT PRIMARY KEY, title VARCHAR(120) NOT NULL);
CREATE TABLE teacher (
 teacher_id BIGINT PRIMARY KEY, name VARCHAR(80) NOT NULL,
 course_id BIGINT NOT NULL,
 FOREIGN KEY(course_id) REFERENCES course(course_id)
);
CREATE INDEX ix_teacher_course ON teacher(course_id,teacher_id);
CREATE TABLE enrollment (
 student_id BIGINT NOT NULL, course_id BIGINT NOT NULL,
 PRIMARY KEY(student_id,course_id),
 FOREIGN KEY(student_id) REFERENCES student(student_id),
 FOREIGN KEY(course_id) REFERENCES course(course_id)
);
CREATE INDEX ix_enrollment_course ON enrollment(course_id,student_id);
INSERT INTO course VALUES(10,'Databases'),(20,'Networks'),(30,'Empty');
INSERT INTO student VALUES(1,'A'),(2,'B'),(3,'C');
INSERT INTO teacher VALUES(100,'T1',10),(200,'T2',10),(300,'T3',20);
INSERT INTO enrollment VALUES(1,10),(1,20),(2,10);
-- Illustration only: retain courses with no students; count each student once.
SELECT c.course_id,c.title,COUNT(e.student_id) AS students
FROM course c LEFT JOIN enrollment e ON e.course_id=c.course_id
GROUP BY c.course_id,c.title ORDER BY c.course_id;
-- A raw join to teacher multiplies course 10's two students by its two teachers.
-- To report both counts, aggregate the two independent relations before joining.
SELECT c.course_id,COALESCE(s.n,0) AS students,COALESCE(t.n,0) AS teachers
FROM course c
LEFT JOIN (SELECT course_id,COUNT(*) AS n FROM enrollment GROUP BY course_id) s
 ON s.course_id=c.course_id
LEFT JOIN (SELECT course_id,COUNT(*) AS n FROM teacher GROUP BY course_id) t
 ON t.course_id=c.course_id
ORDER BY c.course_id;
