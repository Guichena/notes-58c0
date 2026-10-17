#include <array>
#include <atomic>
#include <condition_variable>
#include <exception>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <shared_mutex>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <unordered_map>
#include <vector>

void check(bool value, const char* message) { if (!value) throw std::runtime_error(message); }

template<class T> class BlockingQueue {
    static_assert(std::is_nothrow_move_constructible_v<T> && std::is_nothrow_destructible_v<T>,
                  "queue elements must have nonthrowing move construction and destruction");
    std::mutex mutex_;
    std::condition_variable not_empty_, not_full_;
    std::queue<T> data_;
    const std::size_t capacity_;
    bool closed_ = false;
public:
    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {
        if (!capacity) throw std::invalid_argument("positive capacity required");
    }
    bool push(T item) {
        std::unique_lock lock(mutex_);
        not_full_.wait(lock, [&] { return closed_ || data_.size() < capacity_; });
        if (closed_) return false;
        try { data_.push(std::move(item)); }
        catch (...) {
            // A failed allocation did not consume the slot; let another producer try.
            lock.unlock(); not_full_.notify_one(); throw;
        }
        lock.unlock(); not_empty_.notify_one(); return true;
    }
    std::optional<T> pop() {
        std::unique_lock lock(mutex_);
        not_empty_.wait(lock, [&] { return closed_ || !data_.empty(); });
        if (data_.empty()) return std::nullopt;
        T value = std::move(data_.front()); data_.pop();
        lock.unlock(); not_full_.notify_one(); return value;
    }
    void close() {
        { std::lock_guard lock(mutex_); closed_ = true; }
        not_empty_.notify_all(); not_full_.notify_all();
    }
};

/** Every shard owns an independent unordered_map, so each rehash stays under its shard lock. */
template<class K, class V, std::size_t N = 8> class ShardedMap {
    static_assert(N > 0);
    struct Shard { mutable std::shared_mutex mutex; std::unordered_map<K, V> data; };
    std::array<Shard, N> shards_;
    std::size_t index(const K& key) const { return std::hash<K>{}(key) % N; }
public:
    void put(const K& key, const V& value) {
        auto& shard = shards_[index(key)]; std::unique_lock lock(shard.mutex);
        shard.data.insert_or_assign(key, value);
    }
    std::optional<V> get(const K& key) const {
        const auto& shard = shards_[index(key)]; std::shared_lock lock(shard.mutex);
        auto it = shard.data.find(key);
        if (it == shard.data.end()) return std::nullopt;
        return it->second; // A copy, not an iterator/reference whose lifetime escapes the lock.
    }
    bool erase(const K& key) {
        auto& shard = shards_[index(key)]; std::unique_lock lock(shard.mutex);
        return shard.data.erase(key) != 0;
    }
    std::unordered_map<K, V> snapshot() const {
        std::vector<std::shared_lock<std::shared_mutex>> locks;
        locks.reserve(N);
        for (const auto& shard : shards_) locks.emplace_back(shard.mutex); // One global lock order.
        std::unordered_map<K, V> copy;
        for (const auto& shard : shards_) copy.insert(shard.data.begin(), shard.data.end());
        return copy;
    }
};

/** Only ordinary lock/unlock protect metadata. Busy waiting is for the constrained exercise. */
class MutexOnlyRwLock {
    std::mutex state_;
    unsigned readers_ = 0, waiting_writers_ = 0;
    bool writer_ = false;
public:
    void lock_shared() {
        for (;;) {
            state_.lock();
            if (!writer_ && waiting_writers_ == 0) { ++readers_; state_.unlock(); return; }
            state_.unlock(); std::this_thread::yield();
        }
    }
    void unlock_shared() { state_.lock(); --readers_; state_.unlock(); }
    void lock() {
        state_.lock(); ++waiting_writers_; state_.unlock();
        for (;;) {
            state_.lock();
            if (!writer_ && readers_ == 0) {
                --waiting_writers_; writer_ = true; state_.unlock(); return;
            }
            state_.unlock(); std::this_thread::yield();
        }
    }
    void unlock() { state_.lock(); writer_ = false; state_.unlock(); }
};

struct Singleton {
    int answer = 42;
    static Singleton& instance() { static Singleton value; return value; }
private:
    Singleton() = default;
public:
    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;
};

int main() {
    BlockingQueue<int> queue(8);
    std::mutex seen_mutex, error_mutex;
    std::vector<bool> seen(4000);
    std::exception_ptr error;
    auto protect = [&](auto body) {
        try { body(); }
        catch (...) {
            { std::lock_guard lock(error_mutex); if (!error) error = std::current_exception(); }
            queue.close();
        }
    };
    std::vector<std::thread> producers, consumers;
    for (int c = 0; c < 4; ++c) consumers.emplace_back([&] { protect([&] {
        while (auto item = queue.pop()) {
            std::lock_guard lock(seen_mutex);
            check(*item >= 0 && *item < 4000 && !seen[*item], "duplicate/range"); seen[*item] = true;
        }
    }); });
    for (int p = 0; p < 4; ++p) producers.emplace_back([&, p] { protect([&] {
        for (int i = 0; i < 1000; ++i) check(queue.push(p * 1000 + i), "unexpected close");
    }); });
    for (auto& producer : producers) producer.join();
    queue.close();
    for (auto& consumer : consumers) consumer.join();
    if (error) std::rethrow_exception(error);
    for (bool value : seen) check(value, "lost item");
    check(!queue.push(0) && !queue.pop().has_value(), "closed behavior");
    BlockingQueue<int> full(1); check(full.push(0), "zero accepted");
    std::atomic<bool> rejected{false};
    std::thread blocked([&] { rejected = !full.push(1); }); full.close(); blocked.join();
    check(rejected && full.pop() == 0 && !full.pop(), "close releases producer and drains");
    ShardedMap<int, int> map;
    std::vector<std::thread> writers;
    for (int t = 0; t < 4; ++t) writers.emplace_back([&, t] {
        for (int i = 0; i < 1000; ++i) map.put(t * 1000 + i, i);
    });
    for (auto& writer : writers) writer.join();
    check(map.snapshot().size() == 4000 && map.get(3999) == 999, "sharded map rehash/copy");
    check(map.erase(3999) && !map.get(3999), "erase");
    MutexOnlyRwLock rw; int counter = 0;
    writers.clear();
    for (int t = 0; t < 4; ++t) writers.emplace_back([&] {
        for (int i = 0; i < 1000; ++i) { std::lock_guard lock(rw); ++counter; }
    });
    for (auto& writer : writers) writer.join();
    { std::shared_lock lock(rw); check(counter == 4000, "mutex-only RW protocol"); }
    check(&Singleton::instance() == &Singleton::instance(), "C++11 local-static singleton");
    // std::thread::join waits for the child to finish using the captured resource.
    int resource = 0; std::mutex resource_mutex;
    std::thread child([&] { std::lock_guard lock(resource_mutex); resource = 7; }); child.join();
    check(resource == 7, "child resource use completed");
    std::atomic<int> inventory{1}; int expected = 1;
    check(inventory.compare_exchange_strong(expected, 0), "atomic CAS");
    std::cout << "native_cpp OK\n";
}
