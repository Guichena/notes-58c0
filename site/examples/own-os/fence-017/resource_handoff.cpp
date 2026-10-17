#include <cassert>
#include <chrono>
#include <condition_variable>
#include <exception>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>
// Main creates resource. Child consumes under the same mutex and publishes done.
// Predicate is durable state; condition_variable notification is not stored state.
int handoff(bool notify_before_wait) {
    std::mutex mu;
    std::condition_variable cv;
    int resource = 7;
    bool done = false;
    std::exception_ptr error;
    std::thread worker([&] {
        try {
            std::lock_guard<std::mutex> lock(mu);
            resource *= 6;
            done = true;
        } catch (...) {
            std::lock_guard<std::mutex> lock(mu);
            error = std::current_exception(); done = true;
        }
        cv.notify_one();
    });
    if (notify_before_wait) worker.join(); // tests notification happens before wait
    bool completed;
    int result;
    { std::unique_lock<std::mutex> lock(mu);
      completed = cv.wait_for(lock, std::chrono::seconds(2), [&] { return done; });
      result = resource; }
    // Never join while holding the mutex the worker needs.
    if (worker.joinable()) worker.join();
    assert(completed);
    if (error) std::rethrow_exception(error);
    return result;
}
int main() {
    for (int i = 0; i < 200; ++i) assert(handoff(i % 2 == 0) == 42);
    std::mutex mu; int value = 0; std::vector<std::thread> workers;
    for (int i = 0; i < 4; ++i) workers.emplace_back([&] {
        for (int j = 0; j < 2000; ++j) {
            std::lock_guard<std::mutex> lock(mu); ++value;
        }
    });
    for (auto& t : workers) t.join();
    assert(value == 8000);
    std::cout << "PASS 200 handoffs (100 early notifications) + 8000 protected increments\n";
}

