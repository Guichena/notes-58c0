WITH sales AS (
  SELECT o.merchant_id,
         d.product_id,
         SUM(d.price * d.quantity) AS total_sales
  FROM orders AS o
  JOIN order_details AS d ON d.order_id = o.order_id
  -- 如有时间/状态约束，在这里添加 WHERE，先过滤明细来源。
  GROUP BY o.merchant_id, d.product_id
  HAVING SUM(d.price * d.quantity) > 100000
)
SELECT s.merchant_id, s.product_id, p.product_name, s.total_sales
FROM sales AS s
JOIN products AS p ON p.product_id = s.product_id
ORDER BY s.merchant_id, s.total_sales DESC, s.product_id;
