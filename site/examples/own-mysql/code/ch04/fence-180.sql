-- ClickHouse 25.3.4.190-lts teaching example; run in an isolated database.
CREATE TABLE metric_event (
 tenant_id UInt64,
 event_id String,
 event_time DateTime64(3,'UTC'),
 service LowCardinality(String),
 value Float64
) ENGINE=MergeTree
PARTITION BY toYYYYMM(event_time)
ORDER BY (tenant_id,event_time,event_id)
PRIMARY KEY (tenant_id,event_time);

INSERT INTO metric_event VALUES
 (1,'e1','2026-01-01 01:00:00.000','parse',1.0),
 (1,'e2','2026-01-01 02:00:00.000','parse',3.0),
 (1,'e3','2026-01-01 03:00:00.000','index',2.0),
 (2,'e4','2026-01-01 03:00:00.000','parse',8.0),
 (1,'e5','2026-01-02 00:00:00.000','parse',9.0);

-- Filter only necessary tenants/time ranges and read only required columns.
SELECT service,count() AS events,avg(value) AS avg_value
FROM metric_event
WHERE tenant_id=1
  AND event_time>=toDateTime64('2026-01-01 00:00:00',3,'UTC')
  AND event_time<toDateTime64('2026-01-02 00:00:00',3,'UTC')
GROUP BY service ORDER BY events DESC,service LIMIT 20;

-- This PRIMARY KEY is a sparse access index, NOT a uniqueness constraint.
-- Repeated event_id inserts can appear multiple times. Define deduplication
-- and replay contracts before using count/sum for authoritative reporting.
