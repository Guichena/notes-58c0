CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE employees (
  id INT PRIMARY KEY,
  department_id INT NOT NULL,
  salary DECIMAL(12,2) NOT NULL,
  KEY ix_department_salary (department_id, salary),
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;
INSERT INTO departments VALUES (1,'Engineering'),(2,'Support');
INSERT INTO employees VALUES
  (1,1,60000),(2,1,61000),(3,1,62000),(4,1,63000),
  (5,1,64000),(6,1,65000),(7,1,66000),(8,1,67000),
  (9,1,68000),(10,1,69000),(11,1,70000),(12,1,40000),
  (13,2,80000);
SELECT d.id, d.name, COUNT(*) AS high_paid_count
FROM employees AS e
JOIN departments AS d ON e.department_id = d.id
WHERE e.salary > 50000
GROUP BY d.id, d.name
HAVING COUNT(*) > 10
ORDER BY d.name, d.id
LIMIT 5;
