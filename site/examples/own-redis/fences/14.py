"""Linux fork visibility demonstration; not a Redis BGSAVE test or memory benchmark."""
import os
import threading


def demonstrate():
    state = bytearray(b"old")
    ready_r, ready_w = os.pipe()
    go_r, go_w = os.pipe()
    result_r, result_w = os.pipe()
    pid = os.fork()  # Fork before creating the demonstration thread.
    if pid == 0:
        try:
            os.close(ready_r); os.close(go_w); os.close(result_r)
            os.write(ready_w, b"R")
            if os.read(go_r, 1) != b"G":
                os._exit(2)
            os.write(result_w, state)
            os._exit(0)
        except BaseException:
            os._exit(3)
    os.close(ready_w); os.close(go_r); os.close(result_w)
    try:
        assert os.read(ready_r, 1) == b"R"
        state[:] = b"new"
        os.write(go_w, b"G")
        child_view = os.read(result_r, 3)
        waited, status = os.waitpid(pid, 0)
        assert waited == pid and os.waitstatus_to_exitcode(status) == 0
        assert child_view == b"old" and state == b"new"
        observed = []
        thread = threading.Thread(target=lambda: observed.append(bytes(state)))
        thread.start(); thread.join()
        assert observed == [b"new"]
        return 4
    finally:
        for descriptor in (ready_r, go_w, result_r):
            os.close(descriptor)


if __name__ == "__main__":
    print(f"ForkSnapshot assertions={demonstrate()}")
