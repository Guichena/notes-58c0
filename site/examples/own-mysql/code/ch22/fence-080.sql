-- MySQL 8.4.0 / InnoDB. SETUP only; do not send all session steps on one connection.
CREATE TABLE s3_lock(id INT PRIMARY KEY,score INT NOT NULL,note VARCHAR(20) NOT NULL,
 KEY ix_score(score)) ENGINE=InnoDB;
INSERT INTO s3_lock VALUES(1,10,'a'),(2,20,'b'),(3,30,'c');
CREATE TABLE items(id BIGINT PRIMARY KEY,label VARCHAR(40) NOT NULL,price INT NOT NULL) ENGINE=InnoDB;
INSERT INTO items VALUES(1,'A',10),(2,'A',20),(3,'B',30);
CREATE TABLE range_probe(id INT PRIMARY KEY,k DECIMAL(4,1) NOT NULL,KEY ix_k(k)) ENGINE=InnoDB;
INSERT INTO range_probe VALUES(1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(10,10);
CREATE TABLE unique_probe(id INT PRIMARY KEY,u INT NOT NULL,k INT NOT NULL,note VARCHAR(20) NOT NULL,
 UNIQUE KEY uq_u(u),KEY ix_k(k)) ENGINE=InnoDB;
INSERT INTO unique_probe VALUES(1,10,10,'a'),(2,20,20,'b'),(3,30,20,'c');
CREATE TABLE compound_probe(id INT PRIMARY KEY,a INT NOT NULL,b INT NOT NULL,
 UNIQUE KEY uq_ab(a,b)) ENGINE=InnoDB;
INSERT INTO compound_probe VALUES(1,1,10),(2,1,20),(3,2,10);
CREATE TABLE dup_probe(id INT PRIMARY KEY) ENGINE=InnoDB;
CREATE TABLE mdl_probe(id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO mdl_probe VALUES(1);
