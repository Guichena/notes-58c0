-- Variant A: include students without scores as zero; keep all winners.
WITH totals AS (
  SELECT s.student_id,COALESCE(SUM(sc.score),0) AS total_score
  FROM students AS s
  LEFT JOIN scores AS sc ON sc.student_id=s.student_id
  GROUP BY s.student_id
)
SELECT s.student_id,s.student_name,t.total_score
FROM totals AS t JOIN students AS s ON s.student_id=t.student_id
WHERE t.total_score=(SELECT MAX(total_score) FROM totals)
ORDER BY s.student_id;

-- Variant B: only students with scores participate; one stable winner.
WITH totals AS (
  SELECT student_id,SUM(score) AS total_score
  FROM scores GROUP BY student_id
)
SELECT s.student_id,s.student_name,t.total_score
FROM totals AS t JOIN students AS s ON s.student_id=t.student_id
ORDER BY t.total_score DESC,s.student_id ASC
LIMIT 1;
