"""CPython3.12 coroutine scheduling observations; no IO service contacted."""
import asyncio

async def observe() -> list[str]:
    loop = asyncio.get_running_loop()
    log: list[str] = []
    async def child() -> int:
        log.append('child-start')
        await asyncio.sleep(0)
        log.append('child-end')
        return 7
    coroutine = child()
    assert log == []  # Calling async def creates a coroutine, not an eager body run.
    task = asyncio.create_task(coroutine)
    log.append('caller')
    await asyncio.sleep(0)
    assert log == ['caller', 'child-start']
    assert await task == 7
    assert log == ['caller', 'child-start', 'child-end']
    done = loop.create_future()
    done.set_result(9)
    loop.call_soon(log.append, 'callback')
    assert await done == 9
    assert log[-1] == 'child-end'  # Awaiting a done Future need not yield in asyncio.
    await asyncio.sleep(0)
    assert log[-1] == 'callback'
    gate = loop.create_future()
    loop.call_soon(gate.set_result, 10)
    assert await gate == 10  # Pending Future suspends and callback can complete it.
    return log

if __name__ == '__main__':
    for _ in range(100):
        assert asyncio.run(observe()) == ['caller', 'child-start', 'child-end', 'callback']
    print('PASS Python100 scheduling rounds; lazy coroutine/task/pending Future/done Future/explicit yield')

