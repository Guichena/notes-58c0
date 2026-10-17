package main

type Integer interface{ ~int | ~int64 }

func main() {
        var x Integer
        _ = x
}
