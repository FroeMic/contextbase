import { afterEach, describe, expect, test, vi } from "vitest"

import { composeEventHandlers } from "./compose-event-handlers"
import { createPreloadIntentController, createPreloadIntentHandlers } from "./preload-intent"

describe("preload intent helpers", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test("composes handlers without preventing default or stopping propagation", () => {
    const calls: string[] = []
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    const handler = composeEventHandlers(
      () => calls.push("existing"),
      () => calls.push("intent"),
    )

    expect(handler).toBeDefined()
    handler?.(event)

    expect(calls).toEqual(["existing", "intent"])
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  test("pointer and focus handlers schedule preload work without awaiting the preload", async () => {
    vi.useFakeTimers()
    const controller = createPreloadIntentController({ delayMs: 25 })
    const preload = vi.fn(() => new Promise(() => undefined))
    const handlers = createPreloadIntentHandlers({
      controller,
      key: "tasks:table",
      preload,
    })

    handlers.onPointerEnter?.({} as never)

    expect(preload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(25)
    expect(preload).toHaveBeenCalledTimes(1)

    controller.dispose()
  })

  test("dedupes pending, in-flight, and recently completed preload keys", async () => {
    vi.useFakeTimers()
    let resolvePreload: () => void = () => undefined
    const controller = createPreloadIntentController({
      cooldownMs: 100,
      delayMs: 10,
      ttlMs: 1_000,
    })
    const preload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve
        }),
    )

    controller.trigger({ key: "task:tsk_1", preload })
    controller.trigger({ key: "task:tsk_1", preload })
    await vi.advanceTimersByTimeAsync(10)
    controller.trigger({ key: "task:tsk_1", preload })
    expect(preload).toHaveBeenCalledTimes(1)

    resolvePreload()
    await vi.runOnlyPendingTimersAsync()
    controller.trigger({ key: "task:tsk_1", preload })
    await vi.advanceTimersByTimeAsync(110)
    expect(preload).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    controller.trigger({ key: "task:tsk_1", preload })
    await vi.advanceTimersByTimeAsync(10)
    expect(preload).toHaveBeenCalledTimes(2)

    controller.dispose()
  })

  test("enforces max concurrency under rapid pointer movement", async () => {
    vi.useFakeTimers()
    const controller = createPreloadIntentController({ delayMs: 0, maxConcurrent: 1 })
    const preload = vi.fn(() => new Promise(() => undefined))

    controller.trigger({ key: "task:tsk_1", preload })
    controller.trigger({ key: "task:tsk_2", preload })
    await vi.advanceTimersByTimeAsync(0)

    expect(preload).toHaveBeenCalledTimes(1)

    controller.dispose()
  })
})
