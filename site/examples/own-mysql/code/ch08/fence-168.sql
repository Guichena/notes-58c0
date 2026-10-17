-- Time is a logical integer in one fixed unit; intervals are [from,to).
CREATE TABLE customer_history (
  customer_id BIGINT NOT NULL, version BIGINT NOT NULL,
  city VARCHAR(40) NOT NULL, valid_from BIGINT NOT NULL, valid_to BIGINT,
  current_marker INTEGER,
  PRIMARY KEY(customer_id,version),
  UNIQUE(customer_id,current_marker),
  CHECK(valid_to IS NULL OR valid_to>valid_from),
  CHECK((valid_to IS NULL AND current_marker IS NOT NULL AND current_marker=1) OR
        (valid_to IS NOT NULL AND current_marker IS NULL))
);
-- NULL historical markers permit several history rows, current_marker=1
-- permits at most one open row per customer. All writers must still enforce
-- nonoverlap and version order; the unique constraint alone does not do that.
-- Point-in-time query, with t bound twice:
-- SELECT * FROM customer_history
-- WHERE customer_id=? AND valid_from<=? AND (valid_to>? OR valid_to IS NULL);
