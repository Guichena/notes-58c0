CREATE TABLE rel_customer(id BIGINT PRIMARY KEY,name VARCHAR(100) NOT NULL);
CREATE TABLE rel_profile(customer_id BIGINT PRIMARY KEY,bio VARCHAR(200),FOREIGN KEY(customer_id) REFERENCES rel_customer(id));
CREATE TABLE rel_order(id BIGINT PRIMARY KEY,customer_id BIGINT NOT NULL,FOREIGN KEY(customer_id) REFERENCES rel_customer(id));
CREATE INDEX ix_order_customer ON rel_order(customer_id,id);
CREATE TABLE rel_course(id BIGINT PRIMARY KEY,name VARCHAR(100) NOT NULL);
CREATE TABLE rel_enrollment(customer_id BIGINT NOT NULL,course_id BIGINT NOT NULL,score DECIMAL(5,2),
 PRIMARY KEY(customer_id,course_id),FOREIGN KEY(customer_id) REFERENCES rel_customer(id),FOREIGN KEY(course_id) REFERENCES rel_course(id));
CREATE INDEX ix_course_customer ON rel_enrollment(course_id,customer_id);
INSERT INTO rel_customer VALUES(1,'same'),(2,'same');
INSERT INTO rel_profile VALUES(1,'learner');
INSERT INTO rel_order VALUES(10,1),(11,1);
INSERT INTO rel_course VALUES(20,'Database'),(21,'Java');
INSERT INTO rel_enrollment VALUES(1,20,90),(1,21,80),(2,20,NULL);
SELECT c.id,o.id AS order_id FROM rel_customer c LEFT JOIN rel_order o ON o.customer_id=c.id ORDER BY c.id,o.id;
SELECT e.customer_id,c.id AS course_id,c.name,e.score FROM rel_enrollment e JOIN rel_course c ON c.id=e.course_id ORDER BY e.customer_id,c.id;
