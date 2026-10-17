-- KEYS[1]: lock key. ARGV[1]: this acquisition's unique random owner token.
-- This protects deletion only; it cannot fence writes to an external resource.
if #KEYS ~= 1 or #ARGV ~= 1 then
    return redis.error_reply('exactly one key and one owner token required')
end
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
