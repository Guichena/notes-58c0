#include <atomic>
#include <cassert>
#include <cstddef>
#include <iostream>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>
// Teaching subset: exact T, scalar delete, separate allocation, mutex counts.
// Distinct pointer instances can share ownership concurrently. The SAME pointer
// instance and the pointee need external synchronization for conflicting access.
// No aliasing, arrays, custom deleter, allocator, or enable_shared_from_this.
template<class T> struct Control {
    std::mutex mu;
    T* ptr;
    std::size_t strong = 1;
    std::size_t weak = 1; // explicit weak owners + one until pointee destruction ends
    inline static std::atomic<int> live{0};
    explicit Control(T* p) : ptr(p) { ++live; }
    ~Control() { --live; }
};
template<class T> void drop_weak(Control<T>* c) {
    bool destroy;
    { std::lock_guard<std::mutex> lk(c->mu); destroy = (--c->weak == 0); }
    if (destroy) delete c;
}
template<class T> class Weak;
template<class T> class Shared {
    Control<T>* c_ = nullptr;
    struct Adopt {};
    Shared(Control<T>* c, Adopt) : c_(c) {} // already incremented by Weak::lock
    friend class Weak<T>;
    void drop() {
        if (!c_) return;
        T* object = nullptr;
        bool last;
        { std::lock_guard<std::mutex> lk(c_->mu);
          last = (--c_->strong == 0);
          if (last) { object = c_->ptr; c_->ptr = nullptr; } }
        if (last) {
            delete object; // never call arbitrary user destructor under count mutex
            drop_weak(c_); // implicit weak protects control during destruction
        }
    }
public:
    Shared() = default;
    explicit Shared(T* p) {
        if (p) { try { c_ = new Control<T>(p); }
                 catch (...) { delete p; throw; } }
    }
    Shared(const Shared& other) : c_(other.c_) {
        if (c_) { std::lock_guard<std::mutex> lk(c_->mu); ++c_->strong; }
    }
    Shared(Shared&& other) noexcept : c_(std::exchange(other.c_, nullptr)) {}
    Shared& operator=(Shared other) { swap(other); return *this; }
    ~Shared() { drop(); }
    void swap(Shared& other) noexcept { std::swap(c_, other.c_); }
    void reset() { Shared{}.swap(*this); }
    T* get() const { return c_ ? c_->ptr : nullptr; }
    T& operator*() const { return *get(); } // same non-null precondition as raw pointer
    T* operator->() const { return get(); }
    explicit operator bool() const { return get() != nullptr; }
    std::size_t use_count() const {
        if (!c_) return 0;
        std::lock_guard<std::mutex> lk(c_->mu); return c_->strong;
    }
};
template<class T> class Weak {
    Control<T>* c_ = nullptr;
public:
    Weak() = default;
    Weak(const Shared<T>& other) : c_(other.c_) {
        if (c_) { std::lock_guard<std::mutex> lk(c_->mu); ++c_->weak; }
    }
    Weak(const Weak& other) : c_(other.c_) {
        if (c_) { std::lock_guard<std::mutex> lk(c_->mu); ++c_->weak; }
    }
    Weak(Weak&& other) noexcept : c_(std::exchange(other.c_, nullptr)) {}
    Weak& operator=(Weak other) { swap(other); return *this; }
    ~Weak() { if (c_) drop_weak(c_); }
    void swap(Weak& other) noexcept { std::swap(c_, other.c_); }
    void reset() { Weak{}.swap(*this); }
    std::size_t use_count() const {
        if (!c_) return 0;
        std::lock_guard<std::mutex> lk(c_->mu); return c_->strong;
    }
    bool expired() const { return use_count() == 0; }
    Shared<T> lock() const {
        if (!c_) return {};
        std::lock_guard<std::mutex> lk(c_->mu);
        if (c_->strong == 0) return {}; // no resurrection after strong reaches zero
        ++c_->strong;
        return Shared<T>(c_, typename Shared<T>::Adopt{});
    }
};
struct Value {
    inline static std::atomic<int> destroyed{0};
    int n = 42;
    ~Value() { ++destroyed; }
};
static std::atomic<int> checks{0};
static void check(bool yes) { assert(yes); ++checks; }
int main() {
    for (int round = 0; round < 1000; ++round) {
        int before = Value::destroyed;
        Shared<Value> p(new Value);
        Weak<Value> w(p);
        check(p.use_count() == 1 && !w.expired());
        { auto q = p; check(q.use_count() == 2);
          auto r = std::move(q); check(!q && r->n == 42);
          r = r; check(r.use_count() == 2); }
        { auto q = w.lock(); check(q && q.use_count() == 2); }
        p.reset(); check(w.expired() && !w.lock());
        check(Value::destroyed == before + 1 && Control<Value>::live == 1);
        { auto q = w; auto r = std::move(q); check(q.expired() && r.expired()); }
        w.reset(); check(Control<Value>::live == 0);
    }
    for (int round = 0; round < 40; ++round) {
        Shared<Value> p(new Value); Weak<Value> w(p);
        std::atomic<bool> go{false}; std::atomic<int> ready{0}; std::vector<std::thread> threads;
        for (int k = 0; k < 4; ++k) threads.emplace_back([local=w, &go, &ready] {
            for (int i=0;i<1000;++i) { auto q=local.lock(); check(q && q->n==42); }
            auto held=local.lock(); check(static_cast<bool>(held));
            ready.fetch_add(1, std::memory_order_release);
            while (!go.load(std::memory_order_acquire)) std::this_thread::yield();
            held.reset();
            for (int i = 0; i < 1000; ++i) {
                auto q = local.lock(); if (q) check(q->n == 42);
            }
        });
        while (ready.load(std::memory_order_acquire)!=4) std::this_thread::yield();
        p.reset(); go.store(true, std::memory_order_release);
        for (auto& t : threads) t.join();
        check(w.expired() && !w.lock()); w.reset(); check(Control<Value>::live == 0);
    }
    check(Value::destroyed == 1040);
    std::cout << "PASS shared/weak " << checks << " assertions; 1000 lifecycle + 40 concurrency rounds\n";
}

