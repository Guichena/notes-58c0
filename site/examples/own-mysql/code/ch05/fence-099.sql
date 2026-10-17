-- MySQL8.4: exact byte identity. A VARCHAR alternative needs explicit collation semantics.
CREATE TABLE import_id (
 job_id BIGINT NOT NULL,
 id_bytes VARBINARY(256) NOT NULL,
 PRIMARY KEY(job_id,id_bytes)
) ENGINE=InnoDB;
-- Submit one bounded transaction/batch, bind values, and handle ONLY duplicate-key
-- errors as duplicates. Do not hide truncation/encoding/constraint errors with IGNORE.
INSERT INTO import_id(job_id,id_bytes) VALUES(?,?);
-- First page includes the minimum/empty byte key if the business domain allows it.
SELECT id_bytes FROM import_id WHERE job_id=? ORDER BY id_bytes LIMIT ?;
-- Subsequent pages use the last emitted byte key, with the job fixed and published.
SELECT id_bytes FROM import_id WHERE job_id=? AND id_bytes>? ORDER BY id_bytes LIMIT ?;
