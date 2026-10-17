"""Demonstrate loop-bound pending Future, not a fake DB/HTTP integration test."""
import asyncio

async def wait_foreign(future):
    try:
        await future
    except RuntimeError as exc:
        assert 'different loop' in str(exc)
        return 'foreign pending Future rejected'
    raise AssertionError('foreign pending Future unexpectedly accepted')

async def local_session():
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    loop.call_soon(future.set_result, 42)
    assert await future == 42

if __name__ == '__main__':
    for _ in range(100):
        owner = asyncio.new_event_loop()
        try:
            pending = owner.create_future()
            assert asyncio.run(wait_foreign(pending)) == 'foreign pending Future rejected'
            pending.cancel()
        finally:
            owner.close()
        asyncio.run(local_session())
    print('PASS 100 foreign-pending failures and 100 same-loop successes')

