-- Minimal reservation schema. For MySQL, select InnoDB and verify target database contracts.
CREATE TABLE stock (
  tenant VARCHAR(80) NOT NULL, sku VARCHAR(80) NOT NULL,
  available BIGINT NOT NULL CHECK (available >= 0),
  PRIMARY KEY (tenant, sku)
);
CREATE TABLE reservation (
  tenant VARCHAR(80) NOT NULL, request_id VARCHAR(80) NOT NULL,
  sku VARCHAR(80) NOT NULL, user_id VARCHAR(80) NOT NULL,
  qty BIGINT NOT NULL CHECK (qty > 0),
  PRIMARY KEY (tenant, request_id),
  UNIQUE (tenant, sku, user_id),
  FOREIGN KEY (tenant, sku) REFERENCES stock(tenant, sku)
);
CREATE TABLE outbox (
  tenant VARCHAR(80) NOT NULL, request_id VARCHAR(80) NOT NULL,
  sku VARCHAR(80) NOT NULL, qty BIGINT NOT NULL CHECK (qty > 0),
  PRIMARY KEY (tenant, request_id),
  FOREIGN KEY (tenant, request_id) REFERENCES reservation(tenant, request_id)
);
