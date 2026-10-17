#include <cassert>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <type_traits>
struct A { char c; int i; char d; };
struct B { int i; char c; char d; };
struct alignas(64) Slot { std::uint64_t value; };
int main() {
    static_assert(std::is_standard_layout_v<A> && std::is_standard_layout_v<B>);
    static_assert(alignof(Slot)>=64 && sizeof(Slot)%64==0);
    Slot slots[2]{};
    assert(reinterpret_cast<std::uintptr_t>(&slots[0])%alignof(Slot)==0);
    assert(reinterpret_cast<std::uintptr_t>(&slots[1])%alignof(Slot)==0);
    unsigned char bytes[8]{};
    std::uint32_t source=0x01020304,decoded=0;
    std::memcpy(bytes+1,&source,sizeof source);
    std::memcpy(&decoded,bytes+1,sizeof decoded); // no misaligned uint32_t dereference
    assert(decoded==source);
    std::cout<<"A size="<<sizeof(A)<<" align="<<alignof(A)<<" offsets="
      <<offsetof(A,c)<<','<<offsetof(A,i)<<','<<offsetof(A,d)
      <<" B size="<<sizeof(B)<<" Slot="<<sizeof(Slot)<<" PASS\n";
}

