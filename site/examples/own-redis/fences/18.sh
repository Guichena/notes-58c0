# 本地独立测试实例默认监听 127.0.0.1:6379。
redis-cli SET 'demo:lock:{resource-1}' 'owner-demo' NX PX 30000
redis-cli --eval compare_delete.lua 'demo:lock:{resource-1}' , 'owner-demo'

# 再次持有同一测试锁，演示 SCRIPT LOAD 和 EVALSHA。
redis-cli SET 'demo:lock:{resource-1}' 'owner-demo' NX PX 30000
sha=$(redis-cli -x SCRIPT LOAD < compare_delete.lua)
redis-cli EVALSHA "$sha" 1 'demo:lock:{resource-1}' 'owner-demo'
