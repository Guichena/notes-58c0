-- Portable teaching DDL; integer UTC times, caller-authenticated tenant IDs.
CREATE TABLE app_user(
 tenant_id BIGINT NOT NULL,user_id BIGINT NOT NULL,login_normalized VARCHAR(128) NOT NULL,
 display_name VARCHAR(128) NOT NULL,status VARCHAR(12) NOT NULL,
 version BIGINT NOT NULL CHECK(version>=0),created_at BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,user_id),UNIQUE(tenant_id,login_normalized),
 CHECK(status IN ('ACTIVE','DISABLED','DELETED')));
CREATE TABLE user_session(
 tenant_id BIGINT NOT NULL,session_id VARCHAR(128) NOT NULL,user_id BIGINT NOT NULL,
 expires_at BIGINT NOT NULL,revoked_at BIGINT,PRIMARY KEY(tenant_id,session_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES app_user(tenant_id,user_id));
CREATE INDEX ix_session_user ON user_session(tenant_id,user_id,expires_at);
