"""CPython reference/cycle retention observations, not an RSS benchmark."""
import gc
import weakref

class Node:
    pass

def main() -> None:
    first = Node()
    alias = first
    ref = weakref.ref(first)
    del first
    assert ref() is alias  # Removing one name does not remove all owners.
    del alias
    gc.collect()
    assert ref() is None

    was_enabled = gc.isenabled()
    gc.disable()
    try:
        left, right = Node(), Node()
        left.peer, right.peer = right, left
        lr, rr = weakref.ref(left), weakref.ref(right)
        del left, right
        assert lr() is not None and rr() is not None
        gc.collect()  # Explicit collection works even with automatic GC disabled.
        assert lr() is None and rr() is None
        cache = {"kept": Node()}
        held = weakref.ref(cache["kept"])
        gc.collect()
        assert held() is not None  # Reachable cache content is not garbage.
        cache.clear()
        gc.collect()
        assert held() is None
    finally:
        if was_enabled:
            gc.enable()
    print("PASS CPython alias/cycle/reachable-cache lifetimes; GC policy restored; no RSS or immediate-free guarantee for all Python implementations")

if __name__ == "__main__":
    main()

