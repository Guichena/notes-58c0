"""Python 3.12 bounded, fail-fast asynchronous tool batch; no network calls."""
import asyncio
import math
from collections.abc import Awaitable, Callable, Sequence
from typing import TypeVar, cast
T = TypeVar("T")

async def run_tools(
    tools: Sequence[Callable[[], Awaitable[T]]],
    *, limit: int = 4, per_tool_timeout: float = 2.0,
    total_timeout: float = 5.0,
) -> list[T]:
    # Snapshot bounded indexed slots; never invoke a caller-defined iterator.
    count = len(tools)
    if type(limit) is not int or not 1 <= limit <= 64 or count > 512:
        raise ValueError("bounded batch/parallelism")
    if any(not math.isfinite(x) or x <= 0 for x in (per_tool_timeout, total_timeout)):
        raise ValueError("positive finite timeouts")
    # Sequence indexing must finish; this bounds slots, not arbitrary user code.
    factories = tuple(tools[i] for i in range(count))
    if any(not callable(f) for f in factories):
        raise TypeError("tool factories required")
    results: list[T | None] = [None] * len(factories)
    semaphore = asyncio.Semaphore(limit)
    async def one(index: int) -> None:
        async with semaphore:
            async with asyncio.timeout(per_tool_timeout):
                results[index] = await factories[index]()
    tasks: list[asyncio.Task[None]] = []
    async with asyncio.timeout(total_timeout):
        async with asyncio.TaskGroup() as group:
            for i in range(len(factories)):
                tasks.append(group.create_task(one(i)))
    # A child cancellation is not a TaskGroup ordinary failure. Propagate it
    # after joining, rather than mistaking its untouched slot for a valid None.
    for task in tasks:
        task.result()
    # Every task completed successfully; None is also a legal tool result.
    return cast(list[T], results)

async def example() -> None:
    async def tool(value: int) -> int:
        await asyncio.sleep(0)
        return value * value
    assert await run_tools([lambda i=i: tool(i) for i in range(10)], limit=3) == [i*i for i in range(10)]
    print("PASS async tool example; no actual model/tool service contacted")

if __name__ == "__main__":
    asyncio.run(example())

