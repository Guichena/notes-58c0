#include <cassert>
#include <cstdarg>
#include <cstddef>
#include <iostream>
#include <memory>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

struct Initialized {
    int first = 1;
    const int second;
    int& ref;
    explicit Initialized(int& r) : first(7), second(first + 1), ref(r) {}
};
inline int square(int x) { return x * x; } // demonstration uses small values

// C-style ellipsis: caller contract is exactly count arguments of promoted type int.
int sum_ints(std::size_t count, ...) {
    va_list args;
    va_start(args, count);
    int sum = 0;
    for (std::size_t i = 0; i < count; ++i) sum += va_arg(args, int);
    va_end(args);
    return sum; // caller must also ensure the sum fits in int
}
template<class T, class... Args>
std::unique_ptr<T> make_owned(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}
const char* category(int&) { return "lvalue"; }
const char* category(const int&) { return "const lvalue"; }
const char* category(int&&) { return "rvalue"; }
template<class T> const char* forwarded(T&& value) {
    return category(std::forward<T>(value));
}

// Deliberate ownership contract: value_ is an ordinary int;
// p_ uniquely owns zero or one independently allocated int, never an array.
class Owner {
    int value_;
    int* p_;
public:
    explicit Owner(int value = 0) noexcept : value_(value), p_(nullptr) {}
    Owner(int value, int payload) : value_(value), p_(new int(payload)) {}
    ~Owner() { delete p_; }
    Owner(const Owner& other)
        : value_(other.value_), p_(other.p_ ? new int(*other.p_) : nullptr) {}
    Owner& operator=(const Owner& other) {
        if (this == &other) return *this;
        // Allocate/copy before changing *this: allocation failure leaves it intact.
        int* next = other.p_ ? new int(*other.p_) : nullptr;
        delete p_;
        p_ = next;
        value_ = other.value_;
        return *this;
    }
    Owner(Owner&& other) noexcept
        : value_(other.value_), p_(std::exchange(other.p_, nullptr)) {}
    Owner& operator=(Owner&& other) noexcept {
        if (this != &other) {
            delete p_;
            value_ = other.value_;
            p_ = std::exchange(other.p_, nullptr);
        }
        return *this;
    }
    int value() const noexcept { return value_; }
    const int* payload() const noexcept { return p_; }
    void set_payload(int value) { assert(p_); *p_ = value; }
};

struct NoCopyMove {
    int value;
    explicit NoCopyMove(int x) : value(x) {}
    NoCopyMove(const NoCopyMove&) = delete;
    NoCopyMove(NoCopyMove&&) = delete;
};
NoCopyMove guaranteed_elision() { return NoCopyMove(9); } // C++17 prvalue
struct Counted {
    static int copies, moves;
    Counted() = default;
    Counted(const Counted&) { ++copies; }
    Counted(Counted&&) noexcept { ++moves; }
};
int Counted::copies = 0;
int Counted::moves = 0;
Counted named_return() { Counted value; return value; } // NRVO optional

int main() {
    int external = 2;
    Initialized obj(external);
    assert(obj.first == 7 && obj.second == 8);
    obj.ref = 4;
    assert(external == 4);
    assert(square(3) == 9 && sum_ints(3, 1, 2, 3) == 6);
    auto text = make_owned<std::string>(3, 'x');
    assert(*text == "xxx");
    int n = 5; const int cn = 6;
    assert(std::string(forwarded(n)) == "lvalue");
    assert(std::string(forwarded(cn)) == "const lvalue");
    assert(std::string(forwarded(7)) == "rvalue");
    int&& named_rvalue_reference = 8;
    assert(std::string(category(named_rvalue_reference)) == "lvalue");
    assert(std::string(forwarded(std::move(named_rvalue_reference))) == "rvalue");
    const int& lifetime_extended = 42;
    assert(lifetime_extended == 42);
    using L = int&; using R = int&&;
    static_assert(std::is_same_v<L&, int&> && std::is_same_v<L&&, int&>);
    static_assert(std::is_same_v<R&, int&> && std::is_same_v<R&&, int&&>);
    Owner a(1, 10), b(2, 20), empty;
    Owner copied(a);
    assert(copied.payload() != a.payload() && *copied.payload() == 10);
    b = a;
    assert(b.value() == 1 && b.payload() != a.payload());
    b.set_payload(30);
    assert(*a.payload() == 10 && *b.payload() == 30);
    a = a;
    assert(*a.payload() == 10);
    b = empty;
    assert(!b.payload() && b.value() == 0);
    (b = copied) = a;
    assert(b.value() == 1 && *b.payload() == 10);
    Owner moved(std::move(b));
    assert(!b.payload() && *moved.payload() == 10);
    empty = std::move(moved);
    assert(!moved.payload() && *empty.payload() == 10);
    empty = std::move(empty);
    assert(*empty.payload() == 10);
    auto no_copy = guaranteed_elision();
    assert(no_copy.value == 9);
    auto nrvo = named_return(); (void)nrvo;
    std::cout << "PASS value/ownership/forwarding; optional NRVO observations copies="
              << Counted::copies << " moves=" << Counted::moves << '\n';
}
