#define _GNU_SOURCE
#include <sys/epoll.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static int checks;
static void check(int ok) { if (!ok) { perror("epoll demonstration"); exit(1); } checks++; }
static int ready(int ep, int timeout) {
    struct epoll_event event; int n;
    do { n = epoll_wait(ep, &event, 1, timeout); } while (n < 0 && errno == EINTR);
    check(n >= 0); return n;
}
static void demo(int edge) {
    int p[2]; check(pipe2(p, O_NONBLOCK | O_CLOEXEC) == 0);
    int ep = epoll_create1(EPOLL_CLOEXEC); check(ep >= 0);
    struct epoll_event e; memset(&e, 0, sizeof e);
    e.events = EPOLLIN | (edge ? EPOLLET : 0); e.data.fd = p[0];
    check(epoll_ctl(ep, EPOLL_CTL_ADD, p[0], &e) == 0);
    check(write(p[1], "ABCD", 4) == 4); check(ready(ep, 100) == 1);
    char b[8]; check(read(p[0], b, 2) == 2); check(b[0] == 'A' && b[1] == 'B');
    check(ready(ep, 0) == (edge ? 0 : 1)); // LT remains ready; ET needs more work locally.
    check(read(p[0], b, sizeof b) == 2); check(b[0] == 'C' && b[1] == 'D');
    check(read(p[0], b, sizeof b) == -1 && errno == EAGAIN);
    check(ready(ep, 0) == 0);
    check(write(p[1], "E", 1) == 1); check(ready(ep, 100) == 1);
    check(read(p[0], b, sizeof b) == 1 && b[0] == 'E');
    check(close(p[1]) == 0); check(ready(ep, 100) == 1);
    check(read(p[0], b, sizeof b) == 0); // EOF is not EAGAIN.
    check(close(p[0]) == 0); check(close(ep) == 0);
}
int main(void) {
    for (int i = 0; i < 100; i++) { demo(0); demo(1); }
    printf("PASS %d checks in 100 LT and 100 ET real local pipe trials; no Redis benchmark\n", checks);
    return 0;
}

