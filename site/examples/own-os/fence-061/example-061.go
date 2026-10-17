package main

import (
    "errors"
    "fmt"
    "io"
    "os"
)

func capture() {
    x := 1
    defer fmt.Println("arg", x)
    defer func() { fmt.Println("closure", x) }()
    x = 2
    fmt.Println("body", x)
}

func named() (r int) {
    defer func() { r += 3 }()
    return 4
}

func unnamed() int {
    x := 4
    defer func() { x += 3 }()
    return x
}

func replacement() {
    defer func() { fmt.Println("recovered", recover()) }()
    defer func() { panic("cleanup") }()
    panic("work")
}

func recoveredResult() (r int) {
    defer func() {
        if p := recover(); p != nil {
            r = -1
        }
    }()
    panic("work")
}

func loopScope() {
    for i := 0; i < 3; i++ {
        defer fmt.Println("loop", i)
    }
    fmt.Println("after-loop")
}

func cleanupPanic() (r int) {
    defer func() { panic("cleanup") }()
    return 9
}

func reportCleanupPanic() {
    defer func() { fmt.Println("cleanup-panic", recover()) }()
    fmt.Println("unreachable-return", cleanupPanic())
}

// copyOne owns only the file it opens; it does not close the caller's dst.
func copyOne(path string, dst io.Writer) (err error) {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer func() {
        err = errors.Join(err, f.Close())
    }()
    _, err = io.Copy(dst, f)
    return err
}

func main() {
    capture()
    fmt.Println("named", named())
    fmt.Println("unnamed", unnamed())
    replacement()
    fmt.Println("panic-result", recoveredResult())
    loopScope()
    reportCleanupPanic()
}
