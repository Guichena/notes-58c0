-- Complete after-image staging; money stored in integer minor units.
CREATE TABLE report_batch (
 tenant_id BIGINT NOT NULL, batch_id VARCHAR(100) NOT NULL, source_hash VARCHAR(64) NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('loading','validated','published','failed')),
 source_watermark VARCHAR(200) NOT NULL, PRIMARY KEY(tenant_id,batch_id)
);
CREATE TABLE ad_fact (
 tenant_id BIGINT NOT NULL, batch_id VARCHAR(100) NOT NULL, event_id VARCHAR(100) NOT NULL,
 event_version BIGINT NOT NULL CHECK(event_version>0), business_day CHAR(10) NOT NULL,
 advertiser_id BIGINT NOT NULL, campaign_id BIGINT NOT NULL, currency CHAR(3) NOT NULL,
 impressions BIGINT NOT NULL CHECK(impressions>=0), clicks BIGINT NOT NULL CHECK(clicks>=0),
 spend_minor BIGINT NOT NULL CHECK(spend_minor>=0), PRIMARY KEY(tenant_id,batch_id,event_id),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES report_batch(tenant_id,batch_id)
);
CREATE INDEX ix_ad_report ON ad_fact(tenant_id,batch_id,advertiser_id,business_day,campaign_id);
-- The service resolves one published immutable batch and binds it for the entire report.
SELECT campaign_id,currency,SUM(impressions) AS impressions,SUM(clicks) AS clicks,
 SUM(spend_minor) AS spend_minor,
 CASE WHEN SUM(impressions)=0 THEN NULL ELSE 1.0*SUM(clicks)/SUM(impressions) END AS ctr
 FROM ad_fact WHERE tenant_id=? AND batch_id=? AND advertiser_id=?
 AND business_day>=? AND business_day<? GROUP BY campaign_id,currency
 ORDER BY campaign_id,currency;
