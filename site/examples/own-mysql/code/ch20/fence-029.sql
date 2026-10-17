-- A2
SELECT id FROM s2_open WHERE status='OPEN' ORDER BY id; -- RC 预期 1,2,3
ROLLBACK;
