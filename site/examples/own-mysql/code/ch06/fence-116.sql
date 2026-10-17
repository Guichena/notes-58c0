-- MySQL 8; `order` is reserved, so quote it. Amount is integer minor currency units.
CREATE TABLE shop(id BIGINT PRIMARY KEY,name VARCHAR(40) NOT NULL,category VARCHAR(40) NOT NULL);
CREATE TABLE `order`(id BIGINT PRIMARY KEY,shop_id BIGINT NOT NULL,status VARCHAR(16) NOT NULL,amount BIGINT NOT NULL);
CREATE INDEX ix_order_shop_status ON `order`(shop_id,status);
INSERT INTO shop VALUES(1,'Same','Food'),(2,'Same','Food'),(3,'Other','Books'),(4,'NoOrders','Books');
INSERT INTO `order` VALUES(11,1,'COMPLETED',100),(12,1,'COMPLETED',200),(13,1,'OPEN',999),(14,2,'OPEN',900),(15,3,'COMPLETED',0);
SELECT s.id,s.name,s.category,COUNT(o.id) AS completed_count,
       COALESCE(SUM(o.amount),0) AS completed_amount
FROM shop s LEFT JOIN `order` o ON o.shop_id=s.id AND o.status='COMPLETED'
GROUP BY s.id,s.name,s.category
ORDER BY completed_amount DESC,s.id ASC;
-- Expected: (1,Same,Food,2,300),(2,Same,Food,0,0),
--           (3,Other,Books,1,0),(4,NoOrders,Books,0,0).
