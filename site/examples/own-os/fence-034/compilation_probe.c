#include <stdio.h>
#define FACTOR 2
static int twice(int x) { return x * FACTOR; }
int main(void) { printf("%d\n", twice(21)); return 0; }

