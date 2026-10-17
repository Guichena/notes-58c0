CREATE TABLE test_table_union_index(
 id BIGINT PRIMARY KEY,merchant_id INT NOT NULL,order_id INT NOT NULL,
 KEY ix_merchant_order(merchant_id,order_id)
) ENGINE=InnoDB;
INSERT INTO test_table_union_index VALUES(1,3,1),(2,3,2),(3,4,3),(4,4,4),(5,5,1),(6,5,2);
SELECT * FROM test_table_union_index WHERE merchant_id=3 AND order_id=2;
-- Expected id=2. All selected columns are present in the secondary index leaf.
