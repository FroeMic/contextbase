import { composeEventHandlers, type EventHandler } from "./compose-event-handlers"

export type PreloadIntentAction = () => Promise<unknown> | unknown

export type PreloadIntentControllerOptions = {
  cooldownMs?: number
  delayMs?: number
  maxConcurrent?: number
  ttlMs?: number
}

export type PreloadIntentController = {
  dispose: () => void
  trigger: (intent: { key: string; preload: PreloadIntentAction }) => void
}

export type PreloadIntentHandlers<TEvent> = {
  onFocus?: EventHandler<TEvent>
  onPointerEnter?: EventHandler<TEvent>
}

export function createPreloadIntentController(
  options: PreloadIntentControllerOptions = {},
): PreloadIntentController {
  const cooldownMs = Math.max(0, options.cooldownMs ?? 150)
  const delayMs = Math.max(0, options.delayMs ?? 40)
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 2)
  const ttlMs = Math.max(cooldownMs, options.ttlMs ?? 5 * 60 * 1000)
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const inFlight = new Set<string>()
  const recent = new Map<string, number>()

  function trigger({ key, preload }: { key: string; preload: PreloadIntentAction }) {
    if (!key || pendingTimers.has(key) || inFlight.has(key)) {
      return
    }

    const now = Date.now()
    const recentUntil = recent.get(key)
    if (recentUntil && recentUntil > now) {
      return
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(key)

      if (inFlight.size >= maxConcurrent) {
        recent.set(key, Date.now() + cooldownMs)
        return
      }

      inFlight.add(key)
      recent.set(key, Date.now() + ttlMs)

      void Promise.resolve()
        .then(preload)
        .catch(() => undefined)
        .finally(() => {
          inFlight.delete(key)
        })
    }, delayMs)

    pendingTimers.set(key, timer)
  }

  function dispose() {
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer)
    }

    pendingTimers.clear()
    inFlight.clear()
    recent.clear()
  }

  return { dispose, trigger }
}

export function createPreloadIntentHandlers<TEvent>({
  controller,
  disabled,
  key,
  onFocus,
  onPointerEnter,
  preload,
}: {
  controller: PreloadIntentController
  disabled?: boolean
  key: string
  onFocus?: EventHandler<TEvent>
  onPointerEnter?: EventHandler<TEvent>
  preload: PreloadIntentAction
}): PreloadIntentHandlers<TEvent> {
  const triggerIntent = () => {
    if (!disabled) {
      controller.trigger({ key, preload })
    }
  }

  return {
    onFocus: composeEventHandlers(onFocus, triggerIntent),
    onPointerEnter: composeEventHandlers(onPointerEnter, triggerIntent),
  }
}
