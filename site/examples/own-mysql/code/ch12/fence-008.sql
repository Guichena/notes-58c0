SET NAMES utf8mb4;
CREATE TABLE t_user (
  id BIGINT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  age INT NOT NULL,
  a INT NOT NULL, b INT NOT NULL, c INT NOT NULL,
  KEY ix_name (name), KEY ix_phone (phone), KEY ix_abc (a,b,c)
) ENGINE=InnoDB;
INSERT INTO t_user VALUES
  (1,'Robert','1300000001',18,1,2,3),
  (9,'Ada','01300000001',20,1,4,5),
  (10,'张三','1300000002',18,2,2,3);
-- 后文 WHERE 示例均可放在 SELECT * FROM t_user 后运行。
EXPLAIN SELECT * FROM t_user WHERE a=1 AND b=2;
EXPLAIN SELECT * FROM t_user WHERE b=2;
EXPLAIN SELECT * FROM t_user WHERE name LIKE '%bert';
EXPLAIN SELECT * FROM t_user WHERE id=1 OR age=18;
-- 普通 name 索引通常不能直接按 LENGTH(name) 的结果定位
SELECT * FROM t_user WHERE LENGTH(name) = 6;
-- 需区分字节长度 LENGTH 和字符长度 CHAR_LENGTH。
-- 匹配的函数索引或生成列索引可能支持表达式条件，需看执行计划。
-- 列上运算可能使普通索引不能直接用于定位
SELECT * FROM t_user WHERE id + 1 = 10;
-- 类型与溢出语义允许时，可改写为：
SELECT * FROM t_user WHERE id = 9;
-- 假设 phone 是字符串列；用字符串参数保持类型一致
SELECT * FROM t_user WHERE phone = '1300000001';
-- phone = 1300000001 会触发数值比较，通常不能借字符串索引直接查找。
-- 这不是精确等价于 CAST(phone AS SIGNED)：应依实际类型转换规则判断。
select * from t_user where id = 1 or age = 18;

SELECT id FROM t_user WHERE phone=1300000001 ORDER BY id;
SELECT id, LENGTH(name),CHAR_LENGTH(name) FROM t_user ORDER BY id;
EXPLAIN SELECT * FROM t_user WHERE name LIKE 'Rob%';
EXPLAIN SELECT * FROM t_user WHERE name LIKE 'R_b%';
