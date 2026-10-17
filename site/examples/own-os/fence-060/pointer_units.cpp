#include <cassert>
#include <climits>
#include <cstddef>
#include <iostream>
#include <type_traits>
// One actual ABI observation, not a claim all machines have the same layout.
int main() {
    int a[3] = {10,20,30};
    int* p = a;
    int* end = a + 3; // one-past pointer is valid to form, not to dereference
    assert(end - p == 3);
    assert(*(p + 1) == 20);
    static_assert(sizeof(char) == 1);
    static_assert(std::is_pointer_v<decltype(p)>);
    std::cout << "CHAR_BIT=" << CHAR_BIT << " sizeof(void*)=" << sizeof(void*)
              << " sizeof(int*)=" << sizeof(p) << " pointer-bits=" << sizeof(p)*CHAR_BIT
              << " sizeof(int)=" << sizeof(int) << " array-elements=" << sizeof(a)/sizeof(a[0]) << '\n';
    std::cout << "PASS valid array arithmetic and byte units; no invalid pointer dereference\n";
}

