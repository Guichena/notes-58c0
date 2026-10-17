#include <cassert>
#include <type_traits>

int select_value(int) { return 10; }
double select_value(double) { return 20.5; }

int main() {
    static_assert(std::is_same_v<decltype(select_value(1)), int>);
    static_assert(std::is_same_v<decltype(select_value(1.0)), double>);
    // The target variable type does not change the overload selected by the int argument.
    double result = select_value(1);
    assert(result == 10.0);
    auto target = static_cast<double (*)(double)>(&select_value);
    assert(target(1.0) == 20.5);
}
