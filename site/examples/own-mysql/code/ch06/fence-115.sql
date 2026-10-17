CREATE TABLE agg_department(id BIGINT PRIMARY KEY,name VARCHAR(40) NOT NULL);
CREATE TABLE agg_employee(id BIGINT PRIMARY KEY,department_id BIGINT NOT NULL,salary DECIMAL(12,2),active INT NOT NULL,FOREIGN KEY(department_id) REFERENCES agg_department(id));
INSERT INTO agg_department VALUES(1,'Engineering'),(2,'Support'),(3,'Empty');
INSERT INTO agg_employee VALUES(1,1,100,1),(2,1,200,1),(3,1,NULL,1),(4,1,900,0),(5,2,50,1),(6,2,50,1);
SELECT department_id,COUNT(*) AS people,COUNT(salary) AS known_salaries,
 SUM(salary) AS total,AVG(salary) AS average_salary,MIN(salary) AS minimum_salary,MAX(salary) AS maximum_salary
FROM agg_employee WHERE active=1
GROUP BY department_id HAVING COUNT(*)>=3
ORDER BY total DESC,department_id LIMIT 10;
-- ON preserves departments with no active employees. COUNT(e.id), not COUNT(*).
SELECT d.id,d.name,COUNT(e.id) AS people,COALESCE(SUM(e.salary),0) AS total
FROM agg_department d LEFT JOIN agg_employee e ON e.department_id=d.id AND e.active=1
GROUP BY d.id,d.name ORDER BY d.id;
-- Rows with identical salaries remain separate employees.
SELECT COUNT(DISTINCT salary) AS different_known_salaries,COUNT(salary) AS known,COUNT(*) AS all_rows
FROM agg_employee WHERE department_id=2;
