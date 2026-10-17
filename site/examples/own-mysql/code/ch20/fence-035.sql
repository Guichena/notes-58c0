-- B1
START TRANSACTION;
UPDATE s2_stock SET available=9,version=1 WHERE sku=1;
COMMIT;
