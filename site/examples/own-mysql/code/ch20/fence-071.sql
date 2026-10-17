-- A2
SELECT id,score,note FROM p WHERE score=15; -- 仍空
SELECT id,score,note FROM p WHERE score=15 FOR UPDATE; -- (2,15,'new')
SELECT id,score,note FROM p WHERE score=15; -- 仍空
ROLLBACK;
