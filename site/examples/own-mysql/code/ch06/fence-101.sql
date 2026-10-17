CREATE TABLE products (
  product_id BIGINT PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  merchant_id BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE order_details (
  line_id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  quantity INT NOT NULL,
  INDEX idx_order_product(order_id,product_id),
  FOREIGN KEY(order_id) REFERENCES orders(order_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id)
) ENGINE=InnoDB;
INSERT INTO products VALUES (10,'same'),(20,'same'),(30,'other'),(40,'boundary');
INSERT INTO orders VALUES
 (1,101,1,'2026-10-01 00:00:00'),
 (2,102,1,'2026-10-02 00:00:00'),
 (3,103,2,'2026-10-03 00:00:00');
INSERT INTO order_details VALUES
 (1,1,10,60000.00,1),(2,2,10,25000.00,2),
 (3,1,20,100000.00,1),(4,2,30,110000.00,1),
 (5,3,10,1.00,1),(6,2,40,100000.01,1);
