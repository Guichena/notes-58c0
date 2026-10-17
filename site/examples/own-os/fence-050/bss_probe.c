#include <assert.h>
#include <stdio.h>
unsigned char zero_area[1024 * 1024];
int initialized = 7;
int main(void) {
    for (unsigned int i=0;i<sizeof zero_area;i++) assert(zero_area[i]==0);
    zero_area[sizeof zero_area - 1]=9;
    assert(initialized==7 && zero_area[sizeof zero_area - 1]==9);
    printf("PASS bss zero initialized bytes=%zu; data=%d\n",sizeof zero_area,initialized);
    return 0;
}

