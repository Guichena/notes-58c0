CREATE TABLE vessel(
 tenant_id BIGINT NOT NULL,vessel_id BIGINT NOT NULL,registry_id VARCHAR(64) NOT NULL,
 name VARCHAR(128) NOT NULL,PRIMARY KEY(tenant_id,vessel_id),UNIQUE(tenant_id,registry_id));
CREATE TABLE position_event(
 tenant_id BIGINT NOT NULL,event_id VARCHAR(64) NOT NULL,vessel_id BIGINT NOT NULL,
 source_id VARCHAR(64) NOT NULL,source_seq BIGINT NOT NULL,observed_at BIGINT NOT NULL,
 received_at BIGINT NOT NULL,longitude DECIMAL(9,6) NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 latitude DECIMAL(8,6) NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 PRIMARY KEY(tenant_id,event_id),UNIQUE(tenant_id,source_id,source_seq),
 FOREIGN KEY(tenant_id,vessel_id) REFERENCES vessel(tenant_id,vessel_id));
CREATE INDEX ix_track ON position_event(tenant_id,vessel_id,observed_at,event_id);
CREATE TABLE vessel_latest(
 tenant_id BIGINT NOT NULL,vessel_id BIGINT NOT NULL,event_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(tenant_id,vessel_id),
 FOREIGN KEY(tenant_id,vessel_id) REFERENCES vessel(tenant_id,vessel_id),
 FOREIGN KEY(tenant_id,event_id) REFERENCES position_event(tenant_id,event_id));
-- Application additionally verifies latest event belongs to this vessel and
-- wins the declared (observed_at, source precedence, source_seq) ordering.
