import { ZeroProvider } from "@rocicorp/zero/react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import type { AuthSession } from "../../auth/client/auth-api"
import {
  type BrowserZeroClient,
  getOrCreateBrowserZero,
  ZERO_CLIENT_RESET_EVENT,
} from "./zero-client-registry"

export function ZeroClientProvider({
  children,
  session,
  zero: providedZero,
}: {
  children: ReactNode
  session: AuthSession
  zero?: BrowserZeroClient | null
}) {
  const [zero, setZero] = useState<BrowserZeroClient | null>(
    () => providedZero ?? getOrCreateBrowserZero(session),
  )

  useEffect(() => {
    setZero(providedZero ?? getOrCreateBrowserZero(session))
  }, [providedZero, session])

  useEffect(() => {
    function handleZeroReset() {
      setZero(getOrCreateBrowserZero(session))
    }

    window.addEventListener(ZERO_CLIENT_RESET_EVENT, handleZeroReset)
    return () => window.removeEventListener(ZERO_CLIENT_RESET_EVENT, handleZeroReset)
  }, [session])

  if (!zero) return null

  return <ZeroProvider zero={zero}>{children}</ZeroProvider>
}
