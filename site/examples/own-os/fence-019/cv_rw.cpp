#include <atomic>
#include <cassert>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>
// Non-reentrant; no upgrade/downgrade; balanced same-thread acquire/release.
// Queued writers have preference, but there is no FIFO fairness guarantee.
class RWLock {
    std::mutex state_;
    std::condition_variable changed_;
    unsigned readers_ = 0;
    unsigned waiting_writers_ = 0;
    bool writer_ = false;
public:
    void acquire_read() {
        std::unique_lock<std::mutex> lock(state_);
        changed_.wait(lock, [&] { return !writer_ && waiting_writers_ == 0; });
        ++readers_;
    }
    void release_read() {
        std::lock_guard<std::mutex> lock(state_);
        assert(readers_ != 0);
        if (--readers_ == 0) changed_.notify_all();
    }
    void acquire_write() {
        std::unique_lock<std::mutex> lock(state_);
        ++waiting_writers_;
        try { changed_.wait(lock, [&] { return !writer_ && readers_ == 0; }); }
        catch (...) { --waiting_writers_; changed_.notify_all(); throw; }
        --waiting_writers_; writer_ = true;
    }
    void release_write() {
        std::lock_guard<std::mutex> lock(state_);
        assert(writer_); writer_ = false; changed_.notify_all();
    }
    unsigned waiting_writers_for_test() {
        std::lock_guard<std::mutex> lock(state_); return waiting_writers_;
    }
};
class ReadGuard {
    RWLock& lock_;
public:
    explicit ReadGuard(RWLock& lock) : lock_(lock) { lock_.acquire_read(); }
    ~ReadGuard() { lock_.release_read(); }
    ReadGuard(const ReadGuard&) = delete;
    ReadGuard& operator=(const ReadGuard&) = delete;
};
class WriteGuard {
    RWLock& lock_;
public:
    explicit WriteGuard(RWLock& lock) : lock_(lock) { lock_.acquire_write(); }
    ~WriteGuard() { lock_.release_write(); }
    WriteGuard(const WriteGuard&) = delete;
    WriteGuard& operator=(const WriteGuard&) = delete;
};
int main() {
    RWLock rw;
    std::atomic<int> entered{0}; std::atomic<bool> leave{false};
    auto reader = [&] { ReadGuard g(rw); ++entered; while (!leave.load()) std::this_thread::yield(); };
    std::thread a(reader), b(reader);
    while (entered.load() != 2) std::this_thread::yield();
    leave = true; a.join(); b.join();
    rw.acquire_read(); std::atomic<int> order{0};
    std::thread w([&] { WriteGuard g(rw); assert(++order == 1); });
    while (rw.waiting_writers_for_test() == 0) std::this_thread::yield();
    std::thread r([&] { ReadGuard g(rw); assert(++order == 2); });
    rw.release_read(); w.join(); r.join();
    int value = 0;
    std::atomic<int> live_r{0}, live_w{0}; std::vector<std::thread> workers;
    for (int i=0;i<6;++i) workers.emplace_back([&,i] {
        for (int j=0;j<1000;++j) {
            if (i<2) {
                WriteGuard g(rw); assert(live_w.fetch_add(1)==0); assert(live_r.load()==0);
                ++value; assert(live_w.fetch_sub(1)==1);
            } else {
                ReadGuard g(rw); ++live_r; assert(live_w.load()==0); assert(value>=0 && value<=2000); --live_r;
            }
        }
    });
    for(auto& t:workers) { t.join(); }
    assert(value==2000);
    try { WriteGuard g(rw); throw 1; } catch(int) {}
    { ReadGuard g(rw); assert(value==2000); }
    std::cout << "PASS RW: 2 concurrent readers, queued-writer preference, 4000 reads, 2000 writes, RAII exception release\n";
}

