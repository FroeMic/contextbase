import { useEffect } from "react"

import { initPostHogBrowserAnalytics } from "./posthog-client"

export function PostHogBrowserAnalytics() {
  useEffect(() => {
    initPostHogBrowserAnalytics()
  }, [])

  return null
}
