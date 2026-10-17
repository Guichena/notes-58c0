#include <assert.h>
#include <stdio.h>
int add42(int x);
int main(void) {
    for (int i=0;i<1000;++i) assert(add42(i)==i+42);
    puts("PASS 1000 library calls");
    return 0;
}

