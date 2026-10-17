-- On MySQL choose InnoDB, utf8mb4/collation, SQL modes and actual ID policy.
CREATE TABLE song(song_id BIGINT PRIMARY KEY,title VARCHAR(200) NOT NULL,duration_ms BIGINT NOT NULL CHECK(duration_ms>=0));
CREATE TABLE album(album_id BIGINT PRIMARY KEY,title VARCHAR(200) NOT NULL);
CREATE TABLE album_track(album_id BIGINT NOT NULL,disc_no INTEGER NOT NULL CHECK(disc_no>0),track_no INTEGER NOT NULL CHECK(track_no>0),song_id BIGINT NOT NULL,
 PRIMARY KEY(album_id,disc_no,track_no),FOREIGN KEY(album_id) REFERENCES album(album_id),FOREIGN KEY(song_id) REFERENCES song(song_id));
CREATE INDEX ix_album_song ON album_track(song_id,album_id);
CREATE TABLE playlist(playlist_id BIGINT PRIMARY KEY,owner_id BIGINT NOT NULL,title VARCHAR(200) NOT NULL);
CREATE TABLE playlist_entry(entry_id BIGINT PRIMARY KEY,playlist_id BIGINT NOT NULL,song_id BIGINT NOT NULL,added_at BIGINT NOT NULL,
 UNIQUE(playlist_id,entry_id),FOREIGN KEY(playlist_id) REFERENCES playlist(playlist_id),FOREIGN KEY(song_id) REFERENCES song(song_id));
CREATE INDEX ix_entry_song ON playlist_entry(song_id,playlist_id);
-- view_user_id=0 is the shared order; positive IDs are authenticated personal views.
-- Auth, view creation and membership mutation protocols are enforced by the service.
CREATE TABLE playlist_order(playlist_id BIGINT NOT NULL,view_user_id BIGINT NOT NULL CHECK(view_user_id>=0),version BIGINT NOT NULL CHECK(version>=0),
 PRIMARY KEY(playlist_id,view_user_id),FOREIGN KEY(playlist_id) REFERENCES playlist(playlist_id));
CREATE TABLE playlist_order_item(playlist_id BIGINT NOT NULL,view_user_id BIGINT NOT NULL,entry_id BIGINT NOT NULL,position_no INTEGER NOT NULL CHECK(position_no>=0),
 PRIMARY KEY(playlist_id,view_user_id,entry_id),UNIQUE(playlist_id,view_user_id,position_no),
 FOREIGN KEY(playlist_id,view_user_id) REFERENCES playlist_order(playlist_id,view_user_id),
 FOREIGN KEY(playlist_id,entry_id) REFERENCES playlist_entry(playlist_id,entry_id));
