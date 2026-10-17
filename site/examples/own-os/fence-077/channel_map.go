// Finite ordered batch using Go1.22+ language features.
// fn must return after ctx cancellation. Caller must not mutate input during copy.
package example

import (
    "context"
    "fmt"
    "sync"
)

type result struct { index, value int; err error }
func invoke(ctx context.Context, fn func(context.Context, int) (int, error), x int) (v int, err error) {
    returned := false
    defer func() {
        if !returned { err = fmt.Errorf("task panic: %v", recover()) }
    }()
    v, err = fn(ctx, x)
    returned = true
    return
}
func OrderedMap(parent context.Context, input []int, parallel int,
    fn func(context.Context, int) (int, error)) ([]int, error) {
    if parent == nil || fn == nil || parallel < 1 || parallel > 64 || len(input) > 10000 {
        return nil, fmt.Errorf("invalid bounded batch configuration")
    }
    if err := parent.Err(); err != nil { return nil, err }
    items := append([]int(nil), input...)
    out := make([]int, len(items))
    ctx, cancel := context.WithCancel(parent)
    defer cancel()
    jobs := make(chan int) // no unbounded pending task queue
    results := make(chan result, parallel)
    var workers sync.WaitGroup
    var producer sync.WaitGroup
    producer.Add(1)
    go func() {
        defer producer.Done()
        defer close(jobs) // sole sender owns closing jobs
        for i := range items {
            select {
            case <-ctx.Done(): return
            case jobs <- i:
            }
        }
    }()
    workers.Add(parallel)
    for k := 0; k < parallel; k++ {
        go func() {
            defer workers.Done()
            for i := range jobs {
                if ctx.Err() != nil { return }
                v, err := invoke(ctx, fn, items[i])
                // Collector keeps draining; errors cannot strand a worker here.
                results <- result{i, v, err}
            }
        }()
    }
    go func() {
        workers.Wait()
        producer.Wait()
        close(results) // no sender can still send after workers.Wait
    }()
    var first error
    completed := 0
    for r := range results {
        if r.err != nil {
            if first == nil { first = r.err; cancel() }
        } else { out[r.index] = r.value; completed++ }
    }
    if first != nil { return nil, first }
    if err := parent.Err(); err != nil { return nil, err }
    if completed != len(items) { return nil, fmt.Errorf("incomplete batch") }
    return out, nil
}

