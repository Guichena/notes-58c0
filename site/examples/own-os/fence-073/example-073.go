package main

func Equal[T comparable](a, b T) bool { return a == b }

func Forward[P any](a, b P) bool { return Equal[P](a, b) }

func main() {}
