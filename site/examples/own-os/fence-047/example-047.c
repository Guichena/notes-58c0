#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct Base Base;
typedef struct Ops {
    int (*value)(const Base *self);
    void (*destroy)(Base *self);
} Ops;
struct Base { const Ops *ops; int common; };
typedef struct Derived { Base base; int extra; } Derived;
_Static_assert(offsetof(Derived, base) == 0, "base is the first member");
static unsigned destroyed;

static int derived_value(const Base *self) {
    /* This callback is installed only for a live Derived's first Base member. */
    const Derived *d = (const Derived *)self;
    return d->base.common > d->extra ? d->base.common : d->extra;
}
static void derived_destroy(Base *self) {
    Derived *d = (Derived *)self;
    ++destroyed;
    free(d);
}
static const Ops derived_ops = {derived_value, derived_destroy};
static Base *derived_new(int common, int extra) {
    Derived *d = malloc(sizeof *d);
    if (!d) return NULL;
    d->base.ops = &derived_ops;
    d->base.common = common;
    d->extra = extra;
    return &d->base;
}
static int base_value(const Base *self) {
    assert(self && self->ops && self->ops->value);
    return self->ops->value(self);
}
static void base_destroy(Base *self) {
    if (self) { assert(self->ops && self->ops->destroy); self->ops->destroy(self); }
}
int main(void) {
    Base *b = derived_new(3, 4);
    if (!b) return 1;
    assert(base_value(b) == 4);
    b->common = 10;
    assert(base_value(b) == 10);
    base_destroy(b); b = NULL;
    assert(destroyed == 1);
    base_destroy(b);
    assert(destroyed == 1);
    puts("PASS C11 embedded-base dispatch and destruction");
    return 0;
}
