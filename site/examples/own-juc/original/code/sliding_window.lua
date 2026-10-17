-- KEYS[1]: authenticated per-user limiter key (same slot for any related keys).
-- ARGV: window_ms, limit, unique_request_member. Counts admission, not a business commit.
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if not window or window <= 0 or window ~= math.floor(window)
   or not limit or limit <= 0 or limit ~= math.floor(limit) or not ARGV[3] then
    return redis.error_reply('invalid limiter arguments')
end
local tm = redis.call('TIME')
local now = tonumber(tm[1]) * 1000 + math.floor(tonumber(tm[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
    return {1, redis.call('ZCARD', KEYS[1])} -- Same admission token is idempotent within retention.
end
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then return {0, count} end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, count + 1}
