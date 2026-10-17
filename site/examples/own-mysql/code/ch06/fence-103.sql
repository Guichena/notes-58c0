WITH sales AS (
  SELECT o.merchant_id, d.product_id,
         SUM(d.price * d.quantity) AS total_sales
  FROM orders AS o
  JOIN order_details AS d ON d.order_id = o.order_id
  GROUP BY o.merchant_id, d.product_id
), ranked AS (
  SELECT merchant_id, product_id, total_sales,
         RANK() OVER (
           PARTITION BY merchant_id
           ORDER BY total_sales DESC
         ) AS sales_rank
  FROM sales
)
SELECT r.merchant_id, r.product_id, p.product_name, r.total_sales
FROM ranked AS r
JOIN products AS p ON p.product_id = r.product_id
WHERE r.sales_rank = 1
ORDER BY r.merchant_id, r.product_id;
