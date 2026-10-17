#include "link_api.h"
long sum7(long a,long b,long c,long d,long e,long f,long g) {
    volatile long local=a+b+c+d+e+f+g;
    return local;
}

