#include <assert.h>
#include <stdio.h>
extern int visible;
int next_count(void);
int from_part(void);
int sum_four(const int a[static 4]);
static int helper(void) { return 13; } /* A different internal-linkage function. */
int main(void) {
    const int a[4] = {1, 2, 3, 4};
    assert(visible == 11 && from_part() == 7 && helper() == 13);
    for (int i = 1; i <= 1000; ++i) assert(next_count() == i);
    assert(sum_four(a) == 10);
    puts("PASS C static storage/linkage, 1000 persistent calls, array contract");
    return 0;
}

