package main

type Counter struct{ n int }

func (c *Counter) Add(n int) { c.n += n }

func main() {
        m := map[string]Counter{"a": Counter{}}
        m["a"].Add(1)
}
