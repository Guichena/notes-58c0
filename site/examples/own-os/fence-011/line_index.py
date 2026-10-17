"""Linux/Python3.12, immutable owned input; byte offsets, UTF-8 at the API edge.
O(1) index lookup + O(line bytes) result; serialized reads/close, not async IO.
The temporary fixed-width index lives on disk and is mapped read-only.
"""
import mmap
import os
import struct
import tempfile
import threading
from types import TracebackType

_U64 = struct.Struct('<Q')

class Lines:
    """Read an immutable regular UTF-8/LF file by zero-based physical line number.

    Constructing scans all bytes into an on-disk uint64 offset index. Each lookup
    locates two offsets in constant work, then returns O(line bytes) data.
    CR immediately before LF is removed; a bare CR is retained. Empty input has
    zero lines and a final LF does not create an additional line. max_line_bytes
    counts encoded bytes including line terminators. Reads and close serialize.
    File replacement/mutation is outside the ownership contract; stat checks
    detect many changes but are not a secure snapshot protocol.

    Errors: ValueError for closed/oversized lines or invalid budgets, IndexError
    for invalid line numbers, UnicodeDecodeError for invalid UTF-8, RuntimeError
    for detected input mutation/short read, and ordinary OSError for I/O failure.
    Cleanup failures are grouped; construction/body failures are retained beside
    cleanup errors. Every owned resource is attempted once, even if another close
    fails; this cannot guarantee that a failing underlying close freed its resource.
    Use as a context manager, or close explicitly; repeated close is harmless.
    """
    def __init__(self, path: str | os.PathLike[str], *, max_line_bytes: int = 1024 * 1024) -> None:
        if isinstance(max_line_bytes, bool) or not isinstance(max_line_bytes, int) or not 1 <= max_line_bytes <= 16*1024*1024:
            raise ValueError('max_line_bytes must be 1..16MiB')
        self._lock = threading.Lock()
        self._data = self._index = self._map = None
        self._closed = True
        self._max = max_line_bytes
        try:
            self._data = open(path, 'rb')
            before = os.fstat(self._data.fileno())
            self._identity = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            if before.st_size >= 1 << 64:
                raise ValueError('offset out of uint64 range')
            self._index = tempfile.TemporaryFile(mode='w+b')
            self._index.write(_U64.pack(0))
            offset = last = count = 0
            while True:
                block = self._data.read(65536)
                if not block:
                    break
                start = 0
                while True:
                    pos = block.find(b'\n', start)
                    if pos < 0:
                        break
                    last = offset + pos + 1
                    self._index.write(_U64.pack(last))
                    count += 1
                    start = pos + 1
                offset += len(block)
            if last < offset:
                self._index.write(_U64.pack(offset))
                count += 1
            after = os.fstat(self._data.fileno())
            if self._identity != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
                raise RuntimeError('input changed during indexing')
            self._index.flush()
            self._map = mmap.mmap(self._index.fileno(), 0, access=mmap.ACCESS_READ)
            self.count = count
            self._closed = False
        except BaseException as error:
            try:
                self._release()
            except BaseException as cleanup_error:
                raise BaseExceptionGroup(
                    'Lines construction and cleanup failed', [error, cleanup_error]
                ) from None
            raise

    def _release(self) -> None:
        errors: list[BaseException] = []
        for name in ('_map', '_index', '_data'):
            obj = getattr(self, name)
            if obj is not None:
                try:
                    obj.close()
                except BaseException as error:
                    errors.append(error)
                finally:
                    setattr(self, name, None)
        if errors:
            raise BaseExceptionGroup('Lines resource cleanup failed', errors)

    def line_bytes(self, number: int) -> bytes:
        with self._lock:
            if self._closed:
                raise ValueError('reader closed')
            if not isinstance(number, int) or isinstance(number, bool) or not 0 <= number < self.count:
                raise IndexError('line number outside 0..count-1')
            st = os.fstat(self._data.fileno())
            if self._identity != (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns):
                raise RuntimeError('input changed; rebuild index')
            lo = _U64.unpack_from(self._map, number*8)[0]
            hi = _U64.unpack_from(self._map, (number+1)*8)[0]
            if hi-lo > self._max:
                raise ValueError('line exceeds configured byte budget')
            out = bytearray()
            while len(out) < hi-lo:
                part = os.pread(self._data.fileno(), hi-lo-len(out), lo+len(out))
                if not part:
                    raise RuntimeError('unexpected EOF; immutable-input contract violated')
                out.extend(part)
            if out.endswith(b'\n'):
                del out[-1:]
                if out.endswith(b'\r'):
                    del out[-1:]
            return bytes(out)

    def line(self, number: int) -> str:
        return self.line_bytes(number).decode('utf-8', errors='strict')

    def close(self) -> None:
        with self._lock:
            self._closed = True
            self._release()

    def __enter__(self) -> "Lines":
        if self._closed:
            raise ValueError('reader closed')
        return self

    def __exit__(self, exc_type: type[BaseException] | None,
                 exc: BaseException | None, traceback: TracebackType | None) -> None:
        try:
            self.close()
        except BaseException as cleanup_error:
            if exc is not None:
                raise BaseExceptionGroup(
                    'Lines body and cleanup failed', [exc, cleanup_error]
                ) from None
            raise

