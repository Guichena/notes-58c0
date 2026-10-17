package main

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "sync/atomic"
    "time"
)

var ErrClosed = errors.New("queue closed")

// CondQueue implements its own ring and conditions, not a channel wrapper.
type CondQueue[T any] struct {
    mu sync.Mutex
    notEmpty, notFull *sync.Cond
    data []T
    head, tail, count int
    closed bool
}
func NewCondQueue[T any](capacity int) *CondQueue[T] {
    if capacity <= 0 { panic("capacity must be positive") }
    q := &CondQueue[T]{data: make([]T, capacity)}
    q.notEmpty, q.notFull = sync.NewCond(&q.mu), sync.NewCond(&q.mu)
    return q
}
func (q *CondQueue[T]) Push(ctx context.Context, value T) error {
    q.mu.Lock()
    stop := context.AfterFunc(ctx, func() {
        q.mu.Lock(); q.notFull.Broadcast(); q.mu.Unlock()
    })
    defer func() { q.mu.Unlock(); stop() }()
    for q.count == len(q.data) && !q.closed && ctx.Err() == nil { q.notFull.Wait() }
    if err := ctx.Err(); err != nil { return err }
    if q.closed { return ErrClosed }
    q.data[q.tail] = value; q.tail = (q.tail + 1) % len(q.data); q.count++
    q.notEmpty.Signal()
    return nil
}
// Pop returns (zero, ErrClosed) only after closed inventory has drained.
func (q *CondQueue[T]) Pop(ctx context.Context) (T, error) {
    q.mu.Lock()
    stop := context.AfterFunc(ctx, func() {
        q.mu.Lock(); q.notEmpty.Broadcast(); q.mu.Unlock()
    })
    defer func() { q.mu.Unlock(); stop() }()
    var zero T
    for q.count == 0 && !q.closed && ctx.Err() == nil { q.notEmpty.Wait() }
    if err := ctx.Err(); err != nil { return zero, err }
    if q.count == 0 { return zero, ErrClosed }
    value := q.data[q.head]; q.data[q.head] = zero
    q.head = (q.head + 1) % len(q.data); q.count--
    q.notFull.Signal()
    return value, nil
}
func (q *CondQueue[T]) Close() {
    q.mu.Lock(); q.closed = true
    q.notEmpty.Broadcast(); q.notFull.Broadcast(); q.mu.Unlock()
}

type Result struct { ID, Value int; Err error }
func safeCall(ctx context.Context, id int, fn func(context.Context, int) (int, error)) (r Result) {
    r.ID = id
    defer func() { if p := recover(); p != nil { r.Err = fmt.Errorf("task panic: %v", p) } }()
    r.Value, r.Err = fn(ctx, id)
    return
}
// Separate exercise: channels coordinate bounded workers. Functions must cooperate with ctx.
func RunChannelPool(ctx context.Context, workers, count int, fn func(context.Context, int) (int, error)) ([]Result, error) {
    if workers <= 0 || count < 0 { return nil, errors.New("invalid size") }
    jobs := make(chan int, workers)
    results := make(chan Result, workers)
    var wg sync.WaitGroup
    for w := 0; w < workers; w++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                if ctx.Err() != nil { return }
                select {
                case <-ctx.Done(): return
                case id, ok := <-jobs:
                    if !ok || ctx.Err() != nil { return }
                    result := safeCall(ctx, id, fn)
                    select { case results <- result: case <-ctx.Done(): return }
                }
            }
        }()
    }
    producerDone := make(chan struct{})
    go func() {
        defer close(producerDone); defer close(jobs)
        for id := 0; id < count; id++ {
            select { case jobs <- id: case <-ctx.Done(): return }
        }
    }()
    go func() { wg.Wait(); close(results) }()
    collected := make([]Result, 0, count)
    for result := range results { collected = append(collected, result) }
    <-producerDone
    return collected, ctx.Err()
}

type Snapshot struct { Version int; Limit int }
func require(ok bool, message string) { if !ok { panic(message) } }
func runChecks() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    q := NewCondQueue[int](8)
    var producers, consumers sync.WaitGroup
    seen := make(map[int]bool); var seenMu sync.Mutex
    failures := make(chan error, 8)
    for c := 0; c < 4; c++ {
        consumers.Add(1)
        go func() {
            defer consumers.Done()
            for {
                value, err := q.Pop(ctx)
                if errors.Is(err, ErrClosed) { return }
                if err != nil { failures <- err; return }
                seenMu.Lock()
                if seen[value] { failures <- errors.New("duplicate"); seenMu.Unlock(); return }
                seen[value] = true; seenMu.Unlock()
            }
        }()
    }
    for p := 0; p < 4; p++ {
        base := p*1000; producers.Add(1)
        go func() {
            defer producers.Done()
            for i := 0; i < 1000; i++ { if err := q.Push(ctx, base+i); err != nil { failures <- err; return } }
        }()
    }
    producers.Wait(); q.Close(); consumers.Wait(); close(failures)
    for err := range failures { panic(err) }
    require(len(seen) == 4000, "MPMC loss")
    require(errors.Is(q.Push(ctx, 0), ErrClosed), "close rejects push")
    small := NewCondQueue[int](1)
    require(small.Push(ctx, 0) == nil, "zero is valid")
    cancelled, stop := context.WithCancel(ctx); stop()
    require(errors.Is(small.Push(cancelled, 1), context.Canceled), "cancel full push")
    small.Close(); value, err := small.Pop(ctx)
    require(err == nil && value == 0, "drain zero")
    _, err = small.Pop(ctx); require(errors.Is(err, ErrClosed), "closed end")
    empty := NewCondQueue[int](1)
    waiting, release := context.WithCancel(ctx)
    done := make(chan error, 1)
    go func() { _, err := empty.Pop(waiting); done <- err }()
    release()
    select { case err := <-done: require(errors.Is(err, context.Canceled), "cancel wait")
    case <-ctx.Done(): panic("cancel did not wake condition") }
    results, err := RunChannelPool(ctx, 5, 100, func(ctx context.Context, id int) (int, error) {
        if id == 7 { panic("controlled") }; return id*id, nil
    })
    require(err == nil && len(results) == 100, "worker count/results")
    panicCount := 0
    for _, r := range results { if r.Err != nil { panicCount++ } }
    require(panicCount == 1, "panic isolated inside worker goroutine")
    var stock atomic.Int64; stock.Store(1)
    require(stock.CompareAndSwap(1, 0) && !stock.CompareAndSwap(1, 0), "Go atomic CAS")
    var root atomic.Pointer[Snapshot]
    root.Store(&Snapshot{Version: 1, Limit: 10})
    old := root.Load(); root.Store(&Snapshot{Version: 2, Limit: 20})
    require(old.Version == 1 && root.Load().Version == 2, "immutable snapshot publication")
    fmt.Println("native_go OK")
}
func main() { runChecks(); cacheAndTenantChecks() }
