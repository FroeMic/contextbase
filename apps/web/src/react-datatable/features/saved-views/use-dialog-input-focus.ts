import { useEffect, useRef } from "react"

export function useDialogInputFocus<TElement extends HTMLInputElement>(open: boolean) {
  const inputRef = useRef<TElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const focusInput = () => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    }
    const timers = [
      window.setTimeout(focusInput, 0),
      window.setTimeout(focusInput, 80),
      window.setTimeout(focusInput, 180),
    ]

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [open])

  return inputRef
}
