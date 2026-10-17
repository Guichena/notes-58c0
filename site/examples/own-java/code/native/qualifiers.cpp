#include <atomic>
#include <cassert>
#include <iostream>
#include <thread>
#include <type_traits>
#include <vector>

static int file_only = 7;
int next_value() { static int count = 0; return ++count; } // Serial calls only.
struct Shared {
    inline static std::atomic<int> constructed{0};
    int value;
    Shared() : value(42) { constructed.fetch_add(1); }
};
Shared& singleton() { static Shared instance; return instance; }
int main() {
    int x = 1, y = 2;
    const int* read_only = &x; read_only = &y;
    int* const fixed_pointer = &x; *fixed_pointer = 3;
    assert(*read_only == 2 && x == 3 && file_only == 7);
    static_assert(std::is_same_v<decltype(x), int>);
    static_assert(std::is_same_v<decltype((x)), int&>);
    assert(next_value() == 1 && next_value() == 2);
    std::atomic<bool> valid{true};
    std::vector<std::thread> workers;
    for (int i = 0; i < 32; ++i) workers.emplace_back([&] {
        if (singleton().value != 42) valid.store(false);
    });
    for (auto& worker : workers) worker.join();
    assert(valid.load() && Shared::constructed.load() == 1);
    volatile int observed = 9; // Demonstrates one observable access, not synchronization.
    int snapshot = observed; assert(snapshot == 9);
    std::cout << "PASS C++20 qualifiers and local static initialization\n";
}
