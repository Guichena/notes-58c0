CREATE TABLE binding_users (
  tenant_id BIGINT NOT NULL, id BIGINT NOT NULL,
  username VARCHAR(200) NOT NULL, PRIMARY KEY(tenant_id,id)
) ENGINE=InnoDB;
CREATE TABLE cache_person (
  tenant BIGINT NOT NULL, id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL, PRIMARY KEY(tenant,id)
) ENGINE=InnoDB;
INSERT INTO binding_users VALUES(1,1,'O''Neil');
INSERT INTO cache_person VALUES(1,1,'before');
