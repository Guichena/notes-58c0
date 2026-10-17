#include <cassert>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <memory>
#include <new>
#include <stdexcept>
#include <vector>
std::size_t checked_bytes(std::size_t count){
    if(count>std::numeric_limits<std::size_t>::max()/sizeof(int))throw std::length_error("size overflow");
    return count*sizeof(int);
}
int main(){
    constexpr std::size_t n=10;
    std::vector<int> automatic_owner(n,0);assert(automatic_owner.size()==n);
    auto array=std::make_unique<int[]>(n); // C++14; unique_ptr itself is C++11.
    for(std::size_t i=0;i<n;++i)assert(array[i]==0);
    int* raw=new int[n]{};raw[9]=42;assert(raw[9]==42);delete[] raw;
    auto c_storage=std::unique_ptr<void,decltype(&std::free)>(std::malloc(checked_bytes(n)),&std::free);
    if(!c_storage)throw std::bad_alloc();
    // Raw storage has not constructed a general C++ object: use placement new.
    int* item=::new(c_storage.get())int(7);assert(*item==7);
    bool overflow=false;
    try{(void)checked_bytes(std::numeric_limits<std::size_t>::max());}catch(const std::length_error&){overflow=true;}
    assert(overflow);
    std::cout<<"PASS vector/unique array/new-delete array/malloc-placement construction/overflow; no forced OOM\n";
}

