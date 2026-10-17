-- Redis 7.2 teaching pre-screen, NOT a durable order commit or a complete reservation service.
-- KEYS[1] = stock:{tenant:voucher:generation}; initialized, persistent integer String.
-- KEYS[2] = claim:{tenant:voucher:generation}:user; String value = stable request ID.
-- Both keys must use the SAME hash tag. Trusted caller binds authenticated user to KEYS[2].
-- ARGV[1] = stable request ID. This script does not publish MQ, persist outbox, or release stock.
-- Returned PREHELD/REPLAY means consult the authoritative order state, never promise issuance.
if #KEYS ~= 2 or #ARGV ~= 1 or KEYS[1] == KEYS[2] then
    return redis.error_reply('two distinct same-slot keys and one request ID required')
end
if #ARGV[1] == 0 or #ARGV[1] > 128 then
    return redis.error_reply('request ID length must be 1..128 bytes')
end
local st = redis.call('TYPE', KEYS[1]).ok
local mt = redis.call('TYPE', KEYS[2]).ok
if st ~= 'string' or (mt ~= 'none' and mt ~= 'string') then
    return redis.error_reply('stock must exist as String; marker must be absent or String')
end
local old = redis.call('GET', KEYS[2])
if old then
    if old == ARGV[1] then return {'REPLAY', old} end
    return {'ALREADY_CLAIMED', old}
end
local raw = redis.call('GET', KEYS[1])
if not raw or not string.match(raw, '^%d+$') or (#raw > 1 and string.sub(raw, 1, 1) == '0') then
    return redis.error_reply('canonical nonnegative decimal stock required')
end
local stock = tonumber(raw)
if #raw > 10 or not stock or stock > 2147483647 then
    return redis.error_reply('teaching stock bound is 0..2147483647')
end
if stock == 0 then return {'SOLD_OUT'} end
-- Normal successful execution is isolated. Redis does NOT roll back earlier writes on errors.
-- ACL/configuration/memory errors after this point need UNKNOWN handling and reconciliation.
local remaining = redis.call('DECR', KEYS[1])
redis.call('SET', KEYS[2], ARGV[1])
return {'PREHELD', ARGV[1], remaining}
