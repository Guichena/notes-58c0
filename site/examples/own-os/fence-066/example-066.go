package main

import "fmt"

func Equal[T comparable](a, b T) bool { return a == b }

func sliceComparisonPanics() (panicked bool) {
        defer func() {
                panicked = recover() != nil
        }()
        _ = Equal[any]([]int{1}, []int{1})
        return false
}

func main() {
        fmt.Println("interface ints equal:", Equal[any](1, 1))
        fmt.Println("interface slices panic:", sliceComparisonPanics())
}
