SELECT r.PROCESSLIST_ID AS waiting_connection,
       b.PROCESSLIST_ID AS blocking_connection,
       l.OBJECT_SCHEMA, l.OBJECT_NAME, l.INDEX_NAME,
       l.LOCK_TYPE, l.LOCK_MODE, l.LOCK_STATUS, l.LOCK_DATA
FROM performance_schema.data_lock_waits AS w
JOIN performance_schema.threads AS r ON r.THREAD_ID=w.REQUESTING_THREAD_ID
JOIN performance_schema.threads AS b ON b.THREAD_ID=w.BLOCKING_THREAD_ID
JOIN performance_schema.data_locks AS l
  ON l.ENGINE=w.ENGINE AND l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID
WHERE l.OBJECT_SCHEMA='mysql_txn_learning';
