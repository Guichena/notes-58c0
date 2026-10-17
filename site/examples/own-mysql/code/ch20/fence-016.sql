USE mysql_txn_learning;
ROLLBACK;
SET autocommit=1;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET SESSION innodb_lock_wait_timeout=120;
SELECT CONNECTION_ID() AS connection_id, VERSION() AS server_version,
       @@global.transaction_isolation AS global_isolation_level,
       @@session.transaction_isolation AS isolation_level,
       @@session.autocommit AS autocommit;
SHOW CREATE TABLE s2_stock;
