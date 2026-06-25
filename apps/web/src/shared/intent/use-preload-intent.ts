import { useEffect, useMemo } from "react"

import {
  createPreloadIntentController,
  createPreloadIntentHandlers,
  type PreloadIntentAction,
  type PreloadIntentControllerOptions,
} from "./preload-intent"

export function usePreloadIntent<TEvent>({
  disabled,
  key,
  onFocus,
  onPointerEnter,
  options,
  preload,
}: {
  disabled?: boolean
  key: string
  onFocus?: (event: TEvent) => void
  onPointerEnter?: (event: TEvent) => void
  options?: PreloadIntentControllerOptions
  preload: PreloadIntentAction
}) {
  const cooldownMs = options?.cooldownMs
  const delayMs = options?.delayMs
  const maxConcurrent = options?.maxConcurrent
  const ttlMs = options?.ttlMs
  const controller = useMemo(
    () =>
      createPreloadIntentController({
        cooldownMs,
        delayMs,
        maxConcurrent,
        ttlMs,
      }),
    [cooldownMs, delayMs, maxConcurrent, ttlMs],
  )

  useEffect(() => () => controller.dispose(), [controller])

  return useMemo(
    () =>
      createPreloadIntentHandlers({
        controller,
        disabled,
        key,
        onFocus,
        onPointerEnter,
        preload,
      }),
    [controller, disabled, key, onFocus, onPointerEnter, preload],
  )
}
