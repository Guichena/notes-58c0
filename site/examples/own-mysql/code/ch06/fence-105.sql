WITH totals AS (
  SELECT student_id, SUM(score) AS total_score
  FROM scores
  GROUP BY student_id
)
SELECT s.student_id, s.student_name, t.total_score
FROM totals AS t
JOIN students AS s ON s.student_id = t.student_id
WHERE t.total_score = (SELECT MAX(total_score) FROM totals)
ORDER BY s.student_id;
