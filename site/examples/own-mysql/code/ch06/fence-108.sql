-- MySQL 8 and standard relational reference fixture; fresh test schema.
CREATE TABLE join_users(id BIGINT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE join_orders(id BIGINT PRIMARY KEY,user_id BIGINT,status VARCHAR(12));
INSERT INTO join_users VALUES(1,'Ada'),(2,'Bo'),(3,'Cy');
INSERT INTO join_orders VALUES(10,1,'OPEN'),(11,1,'CLOSED'),(12,2,'CLOSED');
-- Filter matches in ON: all three users remain.
SELECT u.id,o.id FROM join_users u LEFT JOIN join_orders o
 ON o.user_id=u.id AND o.status='OPEN' ORDER BY u.id,o.id;
-- Expected: (1,10),(2,NULL),(3,NULL).
-- Filter joined rows in WHERE: null-extended rows are removed.
SELECT u.id,o.id FROM join_users u LEFT JOIN join_orders o
 ON o.user_id=u.id WHERE o.status='OPEN' ORDER BY u.id,o.id;
-- Expected: (1,10).
SELECT u.id,COUNT(o.id) AS order_count FROM join_users u
 LEFT JOIN join_orders o ON o.user_id=u.id
 GROUP BY u.id ORDER BY u.id;
-- Expected: (1,2),(2,1),(3,0).
