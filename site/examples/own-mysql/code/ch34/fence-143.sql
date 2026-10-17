CREATE TABLE app_users (
  tenant_id BIGINT NOT NULL,
  id BIGINT NOT NULL,
  username VARCHAR(200) COLLATE utf8mb4_0900_as_cs NOT NULL,
  PRIMARY KEY (tenant_id,id),
  KEY ix_user_name (tenant_id,username,id)
) ENGINE=InnoDB;
