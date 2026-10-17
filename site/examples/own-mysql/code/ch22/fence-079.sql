UPDATE items SET price=price+1 WHERE label='A';
-- 初始值(1,A,10),(2,A,20),(3,B,30)，此语句修改两条 A。
UPDATE items SET price=price+1 WHERE id=1 AND label='A';
-- 才是限制为既定主键的一条。
