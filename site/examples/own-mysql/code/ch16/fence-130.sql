CREATE TABLE feed_item (
 tenant_id BIGINT NOT NULL, item_id BIGINT NOT NULL, state VARCHAR(16) NOT NULL,
 created_us BIGINT NOT NULL, version BIGINT NOT NULL CHECK(version>=0), body TEXT NOT NULL,
 PRIMARY KEY(tenant_id,item_id)
);
CREATE INDEX ix_feed_page ON feed_item(tenant_id,state,created_us,item_id);
INSERT INTO feed_item VALUES
 (7,6,'visible',100,0,'six'),(7,5,'visible',100,0,'five'),
 (7,4,'visible',100,0,'four'),(7,3,'visible',90,0,'three'),
 (8,9,'visible',200,0,'other tenant'),(7,8,'hidden',300,0,'hidden');
SELECT item_id,created_us,version,body FROM feed_item
 WHERE tenant_id=7 AND state='visible' ORDER BY created_us DESC,item_id DESC LIMIT 2;
-- Next page after cursor (100,5), expected 4,3:
SELECT item_id,created_us,version,body FROM feed_item
 WHERE tenant_id=7 AND state='visible' AND(created_us<100 OR(created_us=100 AND item_id<5))
 ORDER BY created_us DESC,item_id DESC LIMIT 2;
UPDATE feed_item SET body='edited',version=version+1
 WHERE tenant_id=7 AND item_id=4 AND version=0 AND state='visible';
SELECT ROW_COUNT() AS first_update_expected_one;
UPDATE feed_item SET body='stale',version=version+1
 WHERE tenant_id=7 AND item_id=4 AND version=0 AND state='visible';
SELECT ROW_COUNT() AS stale_update_expected_zero;
