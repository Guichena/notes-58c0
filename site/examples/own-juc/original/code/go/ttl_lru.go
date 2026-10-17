package main

import (
    "container/list"
    "context"
    "errors"
    "sync"
    "time"
)

type ttlEntry[K comparable, V any] struct { key K; value V; expires time.Time }
type TTLLru[K comparable, V any] struct {
    mu sync.Mutex
    capacity int
    ttl time.Duration
    clock func() time.Time
    entries map[K]*list.Element
    recency *list.List
}
func NewTTLLru[K comparable, V any](capacity int, ttl time.Duration, clock func() time.Time) *TTLLru[K, V] {
    if capacity < 0 || ttl <= 0 || clock == nil { panic("invalid TTL LRU configuration") }
    return &TTLLru[K,V]{capacity: capacity, ttl: ttl, clock: clock, entries: make(map[K]*list.Element), recency: list.New()}
}
func (c *TTLLru[K,V]) remove(element *list.Element) {
    delete(c.entries, element.Value.(*ttlEntry[K,V]).key); c.recency.Remove(element)
}
func (c *TTLLru[K,V]) Get(key K) (V, bool) {
    c.mu.Lock(); defer c.mu.Unlock()
    var zero V
    element := c.entries[key]
    if element == nil { return zero, false }
    item := element.Value.(*ttlEntry[K,V])
    if !c.clock().Before(item.expires) { c.remove(element); return zero, false }
    c.recency.MoveToFront(element); return item.value, true
}
func (c *TTLLru[K,V]) Put(key K, value V) {
    c.mu.Lock(); defer c.mu.Unlock()
    now := c.clock()
    // This simple native version explicitly pays O(n) for expiry-first cleanup.
    for element := c.recency.Back(); element != nil; {
        previous := element.Prev()
        if !now.Before(element.Value.(*ttlEntry[K,V]).expires) { c.remove(element) }
        element = previous
    }
    if element := c.entries[key]; element != nil {
        item := element.Value.(*ttlEntry[K,V]); item.value = value; item.expires = now.Add(c.ttl)
        c.recency.MoveToFront(element); return
    }
    if c.capacity == 0 { return }
    if len(c.entries) == c.capacity { c.remove(c.recency.Back()) }
    c.entries[key] = c.recency.PushFront(&ttlEntry[K,V]{key, value, now.Add(c.ttl)})
}

type tenantKey struct{}
func WithTenant(ctx context.Context, verifiedTenant string) context.Context {
    return context.WithValue(ctx, tenantKey{}, verifiedTenant)
}
type TenantLimiter struct {
    mu sync.Mutex
    users map[string][]time.Time
    limit, maxTenants int
    window time.Duration
    clock func() time.Time
}
func NewTenantLimiter(limit, maxTenants int, window time.Duration, clock func() time.Time) *TenantLimiter {
    if limit <= 0 || maxTenants <= 0 || window <= 0 || clock == nil { panic("invalid limiter configuration") }
    return &TenantLimiter{users: make(map[string][]time.Time), limit: limit, maxTenants: maxTenants, window: window, clock: clock}
}
func (l *TenantLimiter) Allow(ctx context.Context) (bool, error) {
    if err := ctx.Err(); err != nil { return false, err }
    tenant, ok := ctx.Value(tenantKey{}).(string)
    if !ok || tenant == "" { return false, errors.New("verified tenant missing") }
    l.mu.Lock(); defer l.mu.Unlock()
    if err := ctx.Err(); err != nil { return false, err }
    now := l.clock()
    for key, times := range l.users {
        first := 0
        for first < len(times) && !times[first].Add(l.window).After(now) { first++ }
        if first == len(times) { delete(l.users, key) } else if first > 0 {
            copy(times, times[first:]); l.users[key] = times[:len(times)-first]
        }
    }
    times, exists := l.users[tenant]
    if !exists && len(l.users) >= l.maxTenants { return false, nil }
    if len(times) >= l.limit { return false, nil }
    l.users[tenant] = append(times, now); return true, nil
}
func cacheAndTenantChecks() {
    now := time.Unix(0, 0)
    cache := NewTTLLru[string,int](2, 10*time.Second, func() time.Time { return now })
    cache.Put("a", 1); now = now.Add(5*time.Second); cache.Put("b", 2)
    now = now.Add(4*time.Second); _, hit := cache.Get("a"); require(hit, "touch a")
    now = now.Add(time.Second); cache.Put("c", 3)
    _, a := cache.Get("a"); _, b := cache.Get("b"); require(!a && b, "expiry independent of recency")
    limiter := NewTenantLimiter(2, 2, time.Minute, func() time.Time { return now })
    ctx := WithTenant(context.Background(), "authenticated-tenant")
    first, err := limiter.Allow(ctx); require(first && err == nil, "tenant admission")
    second, _ := limiter.Allow(ctx); third, _ := limiter.Allow(ctx); require(second && !third, "tenant limit")
    cancelled, cancel := context.WithCancel(ctx); cancel()
    _, err = limiter.Allow(cancelled); require(errors.Is(err, context.Canceled), "tenant cancellation")
}
