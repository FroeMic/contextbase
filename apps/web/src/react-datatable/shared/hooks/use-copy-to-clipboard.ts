import { useCallback, useEffect, useState } from "react"

export function useCopyToClipboard(timeoutMs = 1500): [(value: string) => Promise<void>, boolean] {
  const [isCopied, setIsCopied] = useState(false)

  const copy = useCallback(async (value: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(value)
    setIsCopied(true)
  }, [])

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeout = window.setTimeout(() => setIsCopied(false), timeoutMs)
    return () => window.clearTimeout(timeout)
  }, [isCopied, timeoutMs])

  return [copy, isCopied]
}
