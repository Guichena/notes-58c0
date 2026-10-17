// Bounded queue with a shared mutex and condition predicates.
package main

import (
    "fmt"
    "sync"
)

// Do not copy Queue after construction. Close rejects writes but drains reads.
// No per-operation cancellation, timeout, fairness, or durable delivery promise.
type Queue struct {
    mu sync.Mutex
    notEmpty, notFull *sync.Cond
    values []int
    head, tail, count int
    closed bool
}

func NewQueue(capacity int) *Queue {
    if capacity <= 0 || capacity > 1000000 { panic("capacity out of bounds") }
    q := &Queue{values: make([]int, capacity)}
    q.notEmpty = sync.NewCond(&q.mu)
    q.notFull = sync.NewCond(&q.mu)
    return q
}
func (q *Queue) Put(value int) bool {
    q.mu.Lock()
    defer q.mu.Unlock()
    for q.count == len(q.values) && !q.closed { q.notFull.Wait() }
    if q.closed { return false }
    q.values[q.tail] = value
    q.tail = (q.tail + 1) % len(q.values)
    q.count++
    q.notEmpty.Signal()
    return true
}
func (q *Queue) Take() (int, bool) {
    q.mu.Lock()
    defer q.mu.Unlock()
    for q.count == 0 && !q.closed { q.notEmpty.Wait() }
    if q.count == 0 { return 0, false }
    value := q.values[q.head]
    q.values[q.head] = 0
    q.head = (q.head + 1) % len(q.values)
    q.count--
    q.notFull.Signal()
    return value, true
}
func (q *Queue) Close() {
    q.mu.Lock()
    defer q.mu.Unlock()
    q.closed = true
    q.notEmpty.Broadcast()
    q.notFull.Broadcast()
}
func main() {
    // Executable example supplied for a real Go toolchain; not claimed executed.
    q := NewQueue(2)
    var workers sync.WaitGroup
    workers.Add(1)
    go func() {
        defer workers.Done()
        for i := 0; i < 100; i++ {
            value, ok := q.Take()
            if !ok || value != i { panic("FIFO") }
        }
        if _, ok := q.Take(); ok { panic("not closed") }
    }()
    for i := 0; i < 100; i++ { if !q.Put(i) { panic("early close") } }
    q.Close()
    workers.Wait()
    if q.Put(101) { panic("write after close") }
    fmt.Println("SPSC example completed")
}

