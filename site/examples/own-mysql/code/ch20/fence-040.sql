-- A2
UPDATE s2_stock SET available=@a_next,version=version+1 WHERE sku=1;
COMMIT;
