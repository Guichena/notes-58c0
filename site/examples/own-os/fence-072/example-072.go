package main

type Count int

func Twice[T int](v T) T { return v + v }

func main() {
        _ = Twice(Count(2))
}
