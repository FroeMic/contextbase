import type { schema, ZeroAuthContext } from "@contextbase/zero-schema"
import { Zero } from "@rocicorp/zero"

import type { AuthSession } from "../../auth/client/auth-api"
import { buildZeroOptions, buildZeroStorageKey } from "./zero-config"

export type BrowserZeroClient = Zero<typeof schema, undefined, ZeroAuthContext>

export const ZERO_CLIENT_RESET_EVENT = "contextbase:zero-client-reset"

const zeroClients = new Map<string, BrowserZeroClient>()

export function getOrCreateBrowserZero(session: AuthSession): BrowserZeroClient | null {
  if (typeof window === "undefined") {
    return null
  }

  const key = zeroStorageKey(session)
  const existing = zeroClients.get(key)
  if (existing) return existing

  let zero: BrowserZeroClient
  zero = new Zero({
    ...buildZeroOptions(session),
    onClientStateNotFound: () => {
      resetBrowserZero(key, zero)
    },
  })
  zeroClients.set(key, zero)
  return zero
}

export function closeBrowserZero(session: AuthSession) {
  const key = zeroStorageKey(session)
  const zero = zeroClients.get(key)
  if (!zero) return

  zeroClients.delete(key)
  void zero.close()
}

function zeroStorageKey(session: AuthSession) {
  return buildZeroStorageKey(session)
}

function resetBrowserZero(key: string, zero: BrowserZeroClient) {
  if (zeroClients.get(key) !== zero) {
    return
  }

  zeroClients.delete(key)
  void zero.close()
  window.dispatchEvent(new CustomEvent(ZERO_CLIENT_RESET_EVENT, { detail: { key } }))
}
