-- Independent MySQL8 teaching schema; duplicate enrollment events are allowed.
CREATE TABLE course_events(student_id BIGINT NOT NULL,course_id BIGINT);
INSERT INTO course_events VALUES
 (1,10),(1,10),(1,20),(2,10),(2,10),(3,10),(3,20),(3,30),
 (4,NULL),(4,10),(4,20),(5,NULL);
SELECT student_id FROM course_events WHERE course_id IS NOT NULL
 GROUP BY student_id HAVING COUNT(DISTINCT course_id)=2 ORDER BY student_id;
-- Expected: 1,4. COUNT(*)=2 would give different, incorrect results here.
