-- MySQL 8.4 teaching schema. Exact byte identity avoids collation merging IDs.
CREATE TABLE inbox (
    scope_id VARBINARY(640) NOT NULL,
    event_id VARBINARY(640) NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    state VARCHAR(16) CHARACTER SET ascii NOT NULL,
    receipt MEDIUMTEXT CHARACTER SET utf8mb4 NULL,
    PRIMARY KEY (scope_id, event_id),
    CHECK (state IN ('PROCESSING', 'DONE'))
) ENGINE=InnoDB;
-- Effect.apply may update business tables and insert an outbox row using the
-- same connection. Do not send HTTP or MQ messages inside that callback.
-- Keep committed inbox rows through the full authorized replay horizon.
