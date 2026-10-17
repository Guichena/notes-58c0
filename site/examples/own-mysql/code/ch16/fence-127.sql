CREATE TABLE page_orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_user_created_id (user_id, created_at DESC, id DESC)
) ENGINE=InnoDB;
CREATE TABLE practice_digit(n INT PRIMARY KEY);
INSERT INTO practice_digit VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);
INSERT INTO page_orders(id,user_id,amount,created_at)
SELECT n+1,IF(n<10500,12345,99999),
       CAST(1+MOD(n,1000)/100 AS DECIMAL(18,2)),
       '2026-10-01 12:00:00.000000'
FROM (
  SELECT a.n+10*b.n+100*c.n+1000*d.n+10000*e.n AS n
  FROM practice_digit a CROSS JOIN practice_digit b CROSS JOIN practice_digit c
  CROSS JOIN practice_digit d CROSS JOIN practice_digit e
) AS seed
WHERE n<10550;
ANALYZE TABLE page_orders;
SELECT id, user_id, amount, created_at
FROM page_orders
WHERE user_id = 12345
ORDER BY created_at DESC, id DESC
LIMIT 50 OFFSET 10000;
SELECT o.id, o.user_id, o.amount, o.created_at
FROM page_orders AS o
JOIN (
  SELECT id, created_at
  FROM page_orders
  WHERE user_id = 12345
  ORDER BY created_at DESC, id DESC
  LIMIT 50 OFFSET 10000
) AS page ON page.id = o.id
ORDER BY page.created_at DESC, page.id DESC;
SELECT id, user_id, amount, created_at
FROM page_orders
WHERE user_id = 12345
  AND (
    created_at < '2026-10-01 12:00:00.000000'
    OR (created_at = '2026-10-01 12:00:00.000000' AND id < 900)
  )
ORDER BY created_at DESC, id DESC
LIMIT 50;
