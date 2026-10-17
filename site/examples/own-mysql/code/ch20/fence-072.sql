-- A2：当前 UPDATE 能面对 B 刚提交的行。
UPDATE p SET note='changed' WHERE score=15;
SELECT ROW_COUNT(); -- 预期 1
SELECT id,score,note FROM p WHERE score=15; -- (2,15,'changed')
ROLLBACK;
