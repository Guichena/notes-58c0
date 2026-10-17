UPDATE inventory
SET stock=stock-?,version=version+1
WHERE tenant_id=? AND sku_id=? AND version=? AND stock>=?;
