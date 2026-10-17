# Independent primary-source receipts, 2026-10-15
All staged text and siblings read. Exact restored source SHA-256 and all three line excerpts independently matched.
- https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html: deadlock rolls back transaction; default timeout statement; business transaction can be explicitly aborted. COMMIT transport ambiguity is separate.
- https://dev.mysql.com/doc/refman/8.4/en/metadata-locking.html: transactional SELECT holds MDL to transaction end. B PENDING owner gate retained; no database run claimed.
- https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html: RR first consistent-read snapshot, own-write exception; RC fresh snapshot per read. Maximum key is not a commit watermark.
- https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html: record/gap/next-key distinctions. Both exact range predicates and five probes retained without predicted lock outcomes.
- https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html: NOW evaluated at query start; not physical commit deadline.
- https://h2database.com/html/license.html: official dual MPL 2.0/EPL 1.0 verified; exact 2.3.232 JAR checksum not fetched/certified.
Author pure Python 9 truth-table / 200 seeded Top10 checks retained as author evidence, not independently rerun or SQL validation. Existing dependency pins not freshly installed or compatibility-certified. No DB/JDBC/JVM/service execution or full-suite/browser layout claim.
