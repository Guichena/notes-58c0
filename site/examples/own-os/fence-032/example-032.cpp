#include <cassert>
#include <initializer_list>
#include <type_traits>

auto declared() -> int;  // trailing return type is already known
auto deduced();          // allowed declaration, not used before definition

auto deduced() { return 7; }
auto declared() -> int { return 9; }

int main() {
    const int source = 3;
    auto copied = source;
    auto& alias = source;
    auto direct{1};
    auto list = {1};
    static_assert(std::is_same_v<decltype(copied), int>);
    static_assert(std::is_same_v<decltype(alias), const int&>);
    static_assert(std::is_same_v<decltype(direct), int>);
    static_assert(std::is_same_v<decltype(list), std::initializer_list<int>>);
    copied = 4;
    assert(source == 3 && copied == 4);
    assert(deduced() == 7 && declared() == 9);
}
