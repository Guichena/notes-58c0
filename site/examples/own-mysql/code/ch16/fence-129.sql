CREATE TABLE user_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  txn_time DATETIME(6) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  INDEX idx_user_time_id (user_id, txn_time DESC, id DESC)
) ENGINE=InnoDB;

INSERT INTO user_transactions(id,user_id,amount,currency,txn_time,description) VALUES
 (1,12345,10.00,'CNY','2026-09-09 00:00:00.000000','inclusive start'),
 (2,12345,20.00,'CNY','2026-10-09 00:00:00.000000','exclusive end'),
 (3,99999,30.00,'CNY','2026-10-08 12:00:00.000000','another user'),
 (4,12345,40.00,'CNY','2026-09-09 00:00:00.000000','same-time tie'),
 (5,12345,50.00,'CNY','2026-10-10 00:00:00.000000','future'),
 (6,12345,60.00,'CNY','2026-09-08 23:59:59.999999','too old'),
 (7,12345,-0.10,'CNY','2026-10-08 12:00:00.123456','outgoing'),
 (8,12345,0.20,'USD','2026-10-08 12:00:00.123456','other currency');
SET @uid=12345;
SET @window_end=CAST('2026-10-09 00:00:00.000000' AS DATETIME(6));
SET @window_start=DATE_SUB(@window_end,INTERVAL 30 DAY);
-- First page: expected IDs 8,7. Literal LIMIT makes this directly runnable.
SELECT id,amount,currency,txn_time,description
FROM user_transactions
WHERE user_id=@uid AND txn_time>=@window_start AND txn_time<@window_end
ORDER BY txn_time DESC,id DESC LIMIT 2;
-- Copy the complete last row cursor; never recompute the window per page.
SET @last_time=CAST('2026-10-08 12:00:00.123456' AS DATETIME(6));
SET @last_id=7;
-- Next page: expected IDs 4,1.
SELECT id,amount,currency,txn_time,description
FROM user_transactions
WHERE user_id=@uid AND txn_time>=@window_start AND txn_time<@window_end
  AND (txn_time<@last_time OR (txn_time=@last_time AND id<@last_id))
ORDER BY txn_time DESC,id DESC LIMIT 2;
