"""Explicit big-endian IEEE binary16 encoding, independent of a vector DB SDK."""
import math
import struct

def encode(values):
    values = list(values)
    if not values or any(not math.isfinite(x) or abs(x) > 65504 for x in values):
        raise ValueError('nonempty finite values in binary16 range required')
    return struct.pack('>' + str(len(values)) + 'e', *values)

def decode(payload, dimension):
    if dimension <= 0 or len(payload) != dimension * 2:
        raise ValueError('dimension/byte length mismatch')
    values = struct.unpack('>' + str(dimension) + 'e', payload)
    if any(not math.isfinite(x) for x in values):
        raise ValueError('nonfinite vector')
    return values

def cosine(a, b):
    """Cosine of equal nonempty finite-float sequences; zero vectors are invalid."""
    if not a or len(a) != len(b) or any(not math.isfinite(x) for x in (*a, *b)):
        raise ValueError('dimension/finite values')
    # Scale each vector independently before squaring: finite extreme inputs
    # must neither overflow to inf nor underflow into a false zero vector.
    sa, sb = max(abs(x) for x in a), max(abs(x) for x in b)
    if sa == 0 or sb == 0:
        raise ValueError('cosine undefined for zero vector')
    aa, bb = [x/sa for x in a], [x/sb for x in b]
    na = math.sqrt(math.fsum(x*x for x in aa))
    nb = math.sqrt(math.fsum(x*x for x in bb))
    score = math.fsum((x/na)*(y/nb) for x,y in zip(aa,bb))
    # Roundoff can put mathematically parallel vectors a few ulps past 1.
    return max(-1.0, min(1.0, score))
