#include <atomic>
#include <cassert>
#include <cstddef>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>
// Non-reentrant teaching lock; balanced operations by the same logical owner.
// The only synchronization primitive in this lock is an ordinary owned mutex.
// yield is a scheduling hint and can be removed without changing safety.
class MutexOnlyRW {
    std::mutex state;
    std::size_t readers = 0, waiting_writers = 0;
    bool writer = false;
public:
    void RLock() {
        for (;;) {
            state.lock();
            if (!writer && waiting_writers == 0) {
                ++readers; state.unlock(); return;
            }
            state.unlock(); std::this_thread::yield();
        }
    }
    void RUnlock() {
        state.lock(); assert(readers > 0 && !writer);
        --readers; state.unlock();
    }
    void WLock() {
        state.lock(); ++waiting_writers; state.unlock();
        for (;;) {
            state.lock();
            if (!writer && readers == 0) {
                --waiting_writers; writer = true; state.unlock(); return;
            }
            state.unlock(); std::this_thread::yield();
        }
    }
    void WUnlock() {
        state.lock(); assert(writer && readers == 0);
        writer = false; state.unlock();
    }
};
int main() {
    MutexOnlyRW rw;
    std::atomic<int> entered{0}; std::atomic<bool> release{false};
    std::vector<std::thread> pair;
    for (int i=0;i<2;++i) pair.emplace_back([&] {
        rw.RLock(); ++entered;
        while (!release.load()) std::this_thread::yield();
        rw.RUnlock();
    });
    while (entered.load()!=2) std::this_thread::yield(); // external timeout bounds test
    release=true; for (auto& t:pair) t.join();
    int value=0;
    std::atomic<int> active_readers{0}, active_writers{0}, reads{0};
    std::atomic<bool> start{false}; std::vector<std::thread> workers;
    for (int t=0;t<4;++t) workers.emplace_back([&] {
        while (!start.load()) std::this_thread::yield();
        for (int i=0;i<1000;++i) {
            rw.RLock(); ++active_readers;
            assert(active_writers.load()==0); assert(value>=0 && value<=2000);
            ++reads; --active_readers; rw.RUnlock();
        }
    });
    for (int t=0;t<2;++t) workers.emplace_back([&] {
        while (!start.load()) std::this_thread::yield();
        for (int i=0;i<1000;++i) {
            rw.WLock(); assert(active_writers.fetch_add(1)==0);
            assert(active_readers.load()==0); ++value;
            assert(active_writers.fetch_sub(1)==1); rw.WUnlock();
        }
    });
    start=true; for(auto& t:workers)t.join();
    assert(value==2000 && reads==4000 && entered==2);
    std::cout<<"PASS RW: 2 simultaneous readers, 4000 reads, 2000 writes\n";
}

