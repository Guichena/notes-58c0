"""Three distinct contracts; the source did not identify which was asked."""

def concatenate(a, b):
    return list(a) + list(b)

def _sorted(a):
    if any(a[i] > a[i + 1] for i in range(len(a) - 1)):
        raise ValueError("input must be nondecreasing")

def merge_sorted(a, b):
    _sorted(a)
    _sorted(b)
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    out.extend(a[i:]); out.extend(b[j:])
    return out

def merge_into(a, m, b):
    """a[:m] and b sorted; a length exactly m+len(b); no shared list."""
    if a is b or type(m) is not int or not 0 <= m <= len(a):
        raise ValueError("invalid alias or logical length")
    if len(a) != m + len(b):
        raise ValueError("insufficient/excess destination capacity")
    # Validate before mutation, without copying the input prefix.
    if any(a[i] > a[i + 1] for i in range(m - 1)):
        raise ValueError("input must be nondecreasing")
    _sorted(b)
    i, j, k = m - 1, len(b) - 1, len(a) - 1
    while j >= 0:
        if i >= 0 and a[i] > b[j]:
            a[k] = a[i]; i -= 1
        else:
            a[k] = b[j]; j -= 1
        k -= 1
    return a
