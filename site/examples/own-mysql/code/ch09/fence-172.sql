-- Independent incident/ticket evidence model; immutable evidence and explicit verified conclusions.
CREATE TABLE incident(
 tenant_id BIGINT NOT NULL,incident_id BIGINT NOT NULL,service_name VARCHAR(100) NOT NULL,
 environment VARCHAR(30) NOT NULL,severity INT NOT NULL,opened_at DATETIME NOT NULL,
 status VARCHAR(20) NOT NULL,version BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,incident_id));
CREATE INDEX ix_incident_service ON incident(tenant_id,service_name,opened_at,incident_id);
CREATE TABLE ticket(
 tenant_id BIGINT NOT NULL,ticket_id BIGINT NOT NULL,incident_id BIGINT NOT NULL,
 source_name VARCHAR(50) NOT NULL,source_ticket_id VARCHAR(100) NOT NULL,
 description_ref VARCHAR(500) NOT NULL,revision BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,ticket_id),UNIQUE(tenant_id,source_name,source_ticket_id),
 FOREIGN KEY(tenant_id,incident_id) REFERENCES incident(tenant_id,incident_id));
CREATE TABLE evidence(
 tenant_id BIGINT NOT NULL,evidence_id BIGINT NOT NULL,source_ref VARCHAR(500) NOT NULL,
 source_hash VARCHAR(64) NOT NULL,observed_at DATETIME NOT NULL,collected_at DATETIME NOT NULL,
 PRIMARY KEY(tenant_id,evidence_id));
CREATE TABLE ticket_evidence(
 tenant_id BIGINT NOT NULL,ticket_id BIGINT NOT NULL,evidence_id BIGINT NOT NULL,
 role_name VARCHAR(30) NOT NULL,
 PRIMARY KEY(tenant_id,ticket_id,evidence_id),
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES ticket(tenant_id,ticket_id),
 FOREIGN KEY(tenant_id,evidence_id) REFERENCES evidence(tenant_id,evidence_id));
