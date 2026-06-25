import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { getBrowserHistoryShortcutAction } from "./browser-history-shortcuts"

export function BrowserHistoryShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getBrowserHistoryShortcutAction(event)

      if (!action) {
        return
      }

      event.preventDefault()

      if (action === "back") {
        router.history.back()
        return
      }

      router.history.forward()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return null
}
