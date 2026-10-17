CREATE DATABASE mysql_tx_lab CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE mysql_tx_lab;
SOURCE schema.sql;
-- 需要范围锁实验时再初始化另一组表：
SOURCE lock_ranges.sql;
