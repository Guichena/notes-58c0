INSERT INTO teachers VALUES (7,'Teacher A');
INSERT INTO students VALUES (1,'same'),(2,'same'),(3,'third'),(4,'no scores');
INSERT INTO courses VALUES (1,'Database',7),(2,'Java',7);
INSERT INTO enrollments VALUES (1,1,80),(1,2,90),(2,1,100),(2,2,70);
SELECT e.student_id,s.student_name,c.course_name,t.teacher_name,e.score
FROM enrollments AS e
JOIN students AS s ON s.student_id=e.student_id
JOIN courses AS c ON c.course_id=e.course_id
JOIN teachers AS t ON t.teacher_id=c.teacher_id
ORDER BY e.student_id,e.course_id;
-- Expected: four enrollment rows; both courses reference teacher 7.
START TRANSACTION;
UPDATE teachers SET teacher_name='Teacher B' WHERE teacher_id=7;
SELECT course_id,teacher_name FROM courses JOIN teachers USING(teacher_id)
ORDER BY course_id;
-- Expected: both courses show Teacher B.
ROLLBACK;
