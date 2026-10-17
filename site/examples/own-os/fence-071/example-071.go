package main

type Set[K comparable] map[K]struct{}

func main() {
        _ = Set[[]int]{}
}
