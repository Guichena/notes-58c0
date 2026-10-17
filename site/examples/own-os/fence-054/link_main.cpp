#include "link_api.h"
#include <cassert>
#include <iostream>
int main() {
    for(long i=0;i<1000;++i) assert(sum7(i,2,3,4,5,6,7)==i+27);
    std::cout<<"PASS 1000 seven-integer-argument calls; inspect target disassembly separately\n";
}

