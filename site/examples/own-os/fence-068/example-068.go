package main

type Adder interface{ Add(int) }
type Counter struct{ n int }

func (c *Counter) Add(n int) { c.n += n }

func main() {
        c := Counter{}
        c.Add(1)
        var _ Adder = c
}
