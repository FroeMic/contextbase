import { useEffect } from "react"

import { identifyPostHogBrowserSession, type PostHogBrowserSessionIdentity } from "./posthog-client"

export function PostHogBrowserIdentity({
  session,
}: {
  session?: PostHogBrowserSessionIdentity | null
}) {
  useEffect(() => {
    identifyPostHogBrowserSession(session)
  }, [session])

  return null
}
