static int hidden = 7; /* Internal linkage, static storage duration. */
int visible = 11;      /* External linkage, static storage duration. */
static int helper(void) { return hidden; }
int next_count(void) {
    static int calls;  /* Block scope, no linkage, static storage duration. */
    return ++calls;
}
int from_part(void) { return helper(); }
int sum_four(const int a[static 4]) { /* C99 minimum accessible-element contract. */
    return a[0] + a[1] + a[2] + a[3];
}

