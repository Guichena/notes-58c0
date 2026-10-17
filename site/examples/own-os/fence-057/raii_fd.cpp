#include <cassert>
#include <cerrno>
#include <fcntl.h>
#include <stdexcept>
#include <type_traits>
#include <unistd.h>
#include <utility>
#include <iostream>
// Linux close: do not retry after EINTR; this owner is move-only.
class Fd {
    int fd_ = -1;
public:
    explicit Fd(int fd = -1) noexcept : fd_(fd) {}
    ~Fd() noexcept { reset(); }
    Fd(const Fd&) = delete;
    Fd& operator=(const Fd&) = delete;
    Fd(Fd&& other) noexcept : fd_(other.release()) {}
    Fd& operator=(Fd&& other) noexcept {
        if (this != &other) { reset(); fd_ = other.release(); }
        return *this;
    }
    int get() const noexcept { return fd_; }
    int release() noexcept { return std::exchange(fd_, -1); }
    void reset() noexcept { int old = release(); if (old >= 0) (void)::close(old); }
};
static bool closed(int fd) {
    errno=0; return ::fcntl(fd,F_GETFD)==-1 && errno==EBADF;
}
int main() {
    static_assert(!std::is_copy_constructible_v<Fd>);
    for (int round=0;round<100;++round) {
        int p[2]; if (::pipe(p)!=0) throw std::runtime_error("pipe");
        int oldRead=p[0],oldWrite=p[1];
        try {
            Fd r(p[0]),w(p[1]);
            Fd moved(std::move(r)); assert(r.get()==-1);
            Fd assigned; assigned=std::move(moved); assert(moved.get()==-1);
            assert(::write(w.get(),"x",1)==1);
            char c=0; assert(::read(assigned.get(),&c,1)==1 && c=='x');
            throw std::runtime_error("owned test exception");
        } catch (const std::runtime_error&) {}
        assert(closed(oldRead) && closed(oldWrite));
        Fd invalid; invalid.reset();
    }
    std::cout<<"PASS 100 RAII FD exception/move/close rounds\n";
}

