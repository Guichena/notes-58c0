SET NAMES utf8mb4;
-- Original three-equality logical workload without an added tenant predicate.
CREATE TABLE book_original(id BIGINT PRIMARY KEY,title VARCHAR(200) NOT NULL,
 category VARCHAR(80) NOT NULL,published_year INT NOT NULL,author_name VARCHAR(80) NOT NULL);
CREATE INDEX ix_original_cya ON book_original(category,published_year,author_name);
INSERT INTO book_original VALUES(1,'A','科幻',2026,'张三'),(2,'B','科幻',2025,'张三'),
 (3,'C','科幻',2026,'李四'),(4,'D','历史',2026,'张三');
SELECT id,title FROM book_original WHERE category='科幻' AND published_year=2026 AND author_name='张三';
CREATE TABLE book (
 tenant_id BIGINT NOT NULL,id BIGINT NOT NULL,title VARCHAR(200) NOT NULL,
 category VARCHAR(80) NOT NULL,published_year INTEGER NOT NULL,author_name VARCHAR(80) NOT NULL,
 PRIMARY KEY(tenant_id,id),CHECK(published_year BETWEEN 1000 AND 9999)
);
CREATE INDEX ix_book_category_year_author ON book(tenant_id,category,published_year,author_name);
INSERT INTO book VALUES
 (7,1,'A','科幻',2026,'张三'),(7,2,'B','科幻',2025,'张三'),
 (8,3,'C','科幻',2026,'张三'),(7,4,'D','历史',2026,'张三');
-- Independent multi-tenant extension.
SELECT id,title FROM book WHERE tenant_id=7 AND category='科幻' AND published_year=2026 AND author_name='张三' ORDER BY id LIMIT 20;
-- "This year" must resolve in an explicit business timezone/clock; do not wrap the indexed year in a function.
