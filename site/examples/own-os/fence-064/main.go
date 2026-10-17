package main

import (
        "fmt"
        "reflect"
)

type Reader interface{ Value() int }
type Adder interface{ Add(int) }

type Counter struct{ n int }

func (c Counter) Value() int { return c.n }
func (c *Counter) Add(n int) { c.n += n }

var _ Reader = Counter{}
var _ Reader = (*Counter)(nil)
var _ Adder = (*Counter)(nil)

type TaskError struct{ message string }

func (e *TaskError) Error() string {
        if e == nil {
                return "empty task error"
        }
        return e.message
}

func finish(failed bool) error {
        if failed {
                return &TaskError{message: "task failed"}
        }
        return nil
}

type Integer interface{ ~int | ~int64 }
type Count int

func Sum[T Integer](xs []T) T {
        var total T
        for _, x := range xs {
                total += x
        }
        return total
}

type Set[K comparable] map[K]struct{}
type Box[T any] struct{ Value T }

func main() {
        c := Counter{}
        c.Add(2)
        var r Reader = c
        var a Adder = &c
        a.Add(3)
        fmt.Println("counter:", r.Value(), c.Value())
        var absent error
        var p *TaskError
        var wrapped error = p
        fmt.Println("nil:", absent == nil, p == nil, wrapped == nil)
        fmt.Println("error:", wrapped.Error(), finish(false) == nil)
        fmt.Println("sum:", Sum([]Count{2, 3}), Sum[int64](nil))
        seen := Set[Count]{Count(2): struct{}{}}
        _, found := seen[Count(2)]
        fmt.Println("set:", found)
        fmt.Println("same box type:", reflect.TypeOf(Box[int]{}) == reflect.TypeOf(Box[string]{}))
}
