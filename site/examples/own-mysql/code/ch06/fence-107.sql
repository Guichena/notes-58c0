-- MySQL 8.0+; run only in a fresh test schema.
CREATE TABLE people (id BIGINT PRIMARY KEY, name VARCHAR(80));
INSERT INTO people VALUES
 (1,'张三'),(2,'张三'),(3,'李四'),(4,NULL),(5,NULL),(6,''),(7,'Ada'),(8,'ada');
-- Duplicate non-NULL names; exact grouping follows the configured collation.
SELECT name, COUNT(*) AS cnt
FROM people WHERE name IS NOT NULL
GROUP BY name HAVING COUNT(*) > 1 ORDER BY name;
-- Every row whose non-NULL name is duplicated.
SELECT id, name FROM (
 SELECT id, name, COUNT(*) OVER (PARTITION BY name) AS cnt
 FROM people WHERE name IS NOT NULL
) AS counted
WHERE cnt > 1 ORDER BY id;
-- Explicitly count NULL as a group too.
SELECT name, COUNT(*) AS cnt
FROM people GROUP BY name HAVING COUNT(*) > 1 ORDER BY name;
