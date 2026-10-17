-- Teaching schema: MySQL 8.4/InnoDB by configured default; no existing tables are changed.
CREATE TABLE metro_station(station_id BIGINT PRIMARY KEY, city_id BIGINT NOT NULL, name VARCHAR(100) NOT NULL);
CREATE TABLE metro_line(line_id BIGINT PRIMARY KEY, city_id BIGINT NOT NULL, name VARCHAR(100) NOT NULL);
CREATE TABLE metro_line_station(
 line_id BIGINT NOT NULL, station_id BIGINT NOT NULL,
 PRIMARY KEY(line_id,station_id),
 FOREIGN KEY(line_id) REFERENCES metro_line(line_id),
 FOREIGN KEY(station_id) REFERENCES metro_station(station_id)
);
CREATE INDEX ix_station_line ON metro_line_station(station_id,line_id);
INSERT INTO metro_station VALUES(1,1,'Central'),(2,1,'River'),(3,1,'Park'),(4,1,'Lake'),(5,2,'Central');
INSERT INTO metro_line VALUES(10,1,'Red'),(20,1,'Blue'),(30,2,'Red');
INSERT INTO metro_line_station VALUES(10,1),(10,2),(20,1),(20,3),(30,5);
-- Bound station IDs 2 and 1. EXISTS returns one boolean even if several lines match.
SELECT EXISTS(
 SELECT 1 FROM metro_line_station a JOIN metro_line_station b ON a.line_id=b.line_id
 WHERE a.station_id=2 AND b.station_id=1
) AS same_line;
-- Return every shared line when requested, not a transit path with transfers.
SELECT l.line_id,l.name FROM metro_line l
JOIN metro_line_station a ON a.line_id=l.line_id
JOIN metro_line_station b ON b.line_id=l.line_id
WHERE a.station_id=2 AND b.station_id=1 ORDER BY l.line_id;
