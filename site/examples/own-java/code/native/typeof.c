#include <assert.h>
#include <stdio.h>
int main(void) {
    int x = 3;
    typeof(x) same_type = 4;
    __typeof__(x++) not_evaluated = 5; /* No variably modified type in this example. */
    const int qualified = 6;
    typeof_unqual(qualified) writable = 7;
    writable++;
    assert(x == 3 && same_type == 4 && not_evaluated == 5 && writable == 8);
    puts("PASS C23 typeof and typeof_unqual");
    return 0;
}
