#include <array>
#include <atomic>
#include <cassert>
#include <cstddef>
#include <iostream>
#include <thread>
// Exactly one producer and one consumer. No close, blocking, or MPMC API.
template<std::size_t Capacity> class SpscRing {
    static_assert(Capacity > 0 && Capacity < 1000000);
    static_assert(std::atomic<std::size_t>::is_always_lock_free,
                  "This example requires lock-free atomic indices");
    std::array<int, Capacity + 1> data_{};
    std::atomic<std::size_t> head_{0}, tail_{0};
    static std::size_t next(std::size_t i) { return (i + 1) % (Capacity + 1); }
public:
    bool try_push(int value) {
        const auto tail = tail_.load(std::memory_order_relaxed);
        const auto n = next(tail);
        if (n == head_.load(std::memory_order_acquire)) return false;
        data_[tail] = value;
        tail_.store(n, std::memory_order_release);
        return true;
    }
    bool try_pop(int& value) {
        const auto head = head_.load(std::memory_order_relaxed);
        if (head == tail_.load(std::memory_order_acquire)) return false;
        value = data_[head];
        head_.store(next(head), std::memory_order_release);
        return true;
    }
};
template<std::size_t N> std::size_t test() {
    std::size_t checks=0;
    for (int trial=0;trial<10;++trial) {
        SpscRing<N> q; int value=-1;
        assert(!q.try_pop(value) && value==-1);++checks;
        for (std::size_t i=0;i<N;++i) { assert(q.try_push(static_cast<int>(i)));++checks; }
        assert(!q.try_push(-100));++checks;
        for (std::size_t i=0;i<N;++i) { assert(q.try_pop(value) && value==static_cast<int>(i));++checks; }
        assert(!q.try_pop(value));++checks;
        constexpr int count=5000;
        std::atomic<bool> start{false};
        std::thread producer([&]{
            while(!start.load(std::memory_order_acquire)) std::this_thread::yield();
            for(int i=0;i<count;++i) while(!q.try_push(i)) std::this_thread::yield();
        });
        std::thread consumer([&]{
            while(!start.load(std::memory_order_acquire)) std::this_thread::yield();
            for(int i=0;i<count;++i) {
                int got;
                while(!q.try_pop(got)) std::this_thread::yield();
                assert(got==i);++checks; // Only this thread changes checks until join.
            }
        });
        start.store(true,std::memory_order_release);
        producer.join();consumer.join();assert(!q.try_pop(value));++checks;
    }
    return checks;
}
int main() {
    const auto checks=test<1>()+test<2>()+test<17>();
    std::cout<<"PASS SPSC capacities 1/2/17, 30 pairs, 150000 ordered values, "<<checks<<" checks\n";
}

