"""CPython 3.12: fixed workers, truly bounded pending queue, explicit close.
Trusted cooperative functions only; no forced interruption of running threads.
"""
from concurrent.futures import Future
from queue import Queue, Empty, Full
from threading import Lock, Thread, current_thread
from typing import Callable, Any

class Rejected(RuntimeError):
    pass

class BoundedPool:
    def __init__(self, workers: int, pending: int):
        if not 1 <= workers <= 32 or not 1 <= pending <= 512:
            raise ValueError("bounded workers and pending capacity")
        self._queue: Queue = Queue(maxsize=pending)
        self._lock = Lock()
        self._closed = False
        self._threads: list[Thread] = []
        try:
            for n in range(workers):
                t = Thread(target=self._work, name=f"bounded-{n}", daemon=False)
                t.start()
                self._threads.append(t)
        except BaseException:
            with self._lock:
                self._closed = True
            for t in self._threads:
                t.join()
            raise

    def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Future:
        if not callable(fn):
            raise TypeError("callable required")
        future: Future = Future()
        with self._lock:
            if self._closed:
                raise Rejected("closed")
            try:
                self._queue.put_nowait((future, fn, args, kwargs))
            except Full:
                raise Rejected("pending queue full") from None
        return future

    def _work(self) -> None:
        while True:
            try:
                future, fn, args, kwargs = self._queue.get(timeout=0.05)
            except Empty:
                with self._lock:
                    if self._closed and self._queue.empty():
                        return
                continue
            try:
                if future.set_running_or_notify_cancel():
                    try:
                        result = fn(*args, **kwargs)
                    except BaseException as exc:
                        future.set_exception(exc)
                    else:
                        future.set_result(result)
            finally:
                self._queue.task_done()

    def shutdown(self, *, wait: bool = True, cancel_pending: bool = False) -> None:
        if wait and current_thread() in self._threads:
            raise RuntimeError("worker must not join its own pool")
        cancelled = []
        with self._lock:
            self._closed = True
            if cancel_pending:
                while True:
                    try:
                        item = self._queue.get_nowait()
                    except Empty:
                        break
                    cancelled.append(item[0])
                    self._queue.task_done()
        # Future callbacks are arbitrary user code: never invoke under pool lock.
        for future in cancelled:
            future.cancel()
        if wait:
            for thread in self._threads:
                thread.join()

