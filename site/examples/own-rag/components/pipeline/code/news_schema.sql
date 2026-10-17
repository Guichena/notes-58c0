-- Independent MySQL-compatible example, unpartitioned. SQLite tests validate constraints only.
CREATE TABLE news_article(
 tenant_id BIGINT NOT NULL,article_id BIGINT NOT NULL,source_id VARCHAR(40) NOT NULL,
 source_article_id VARCHAR(100) NOT NULL,canonical_url VARCHAR(500) NOT NULL,
 title VARCHAR(500) NOT NULL,category VARCHAR(40) NOT NULL,language VARCHAR(20) NOT NULL,
 published_at DATETIME NOT NULL,fetched_at DATETIME NOT NULL,license_ref VARCHAR(200) NOT NULL,
 PRIMARY KEY(tenant_id,article_id),UNIQUE(tenant_id,source_id,source_article_id));
CREATE INDEX ix_news_category_time ON news_article(tenant_id,category,published_at,article_id);
CREATE TABLE news_revision(
 tenant_id BIGINT NOT NULL,article_id BIGINT NOT NULL,revision BIGINT NOT NULL,
 content_ref VARCHAR(500) NOT NULL,content_hash VARCHAR(64) NOT NULL,status VARCHAR(20) NOT NULL,
 PRIMARY KEY(tenant_id,article_id,revision),
 FOREIGN KEY(tenant_id,article_id) REFERENCES news_article(tenant_id,article_id));
CREATE TABLE news_chunk(
 tenant_id BIGINT NOT NULL,article_id BIGINT NOT NULL,revision BIGINT NOT NULL,chunk_id BIGINT NOT NULL,
 text_value TEXT NOT NULL,source_start INT NOT NULL,source_end INT NOT NULL,content_hash VARCHAR(64) NOT NULL,
 PRIMARY KEY(tenant_id,article_id,revision,chunk_id),
 CHECK(source_start>=0 AND source_end>=source_start),
 FOREIGN KEY(tenant_id,article_id,revision) REFERENCES news_revision(tenant_id,article_id,revision));
CREATE TABLE news_embedding(
 tenant_id BIGINT NOT NULL,article_id BIGINT NOT NULL,revision BIGINT NOT NULL,chunk_id BIGINT NOT NULL,
 model_version VARCHAR(120) NOT NULL,dimension INT NOT NULL CHECK(dimension>0),
 metric VARCHAR(20) NOT NULL,index_generation VARCHAR(80) NOT NULL,vector_record_id VARCHAR(180) NOT NULL,
 PRIMARY KEY(tenant_id,article_id,revision,chunk_id,model_version,index_generation),
 UNIQUE(tenant_id,index_generation,vector_record_id),
 FOREIGN KEY(tenant_id,article_id,revision,chunk_id) REFERENCES news_chunk(tenant_id,article_id,revision,chunk_id));
