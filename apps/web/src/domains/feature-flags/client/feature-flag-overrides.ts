import type { ClientFeatureFlagKey } from "@contextbase/core/domains/feature-flags/service"

import type { FeatureFlagSnapshot } from "./feature-flag-snapshot"

export const FEATURE_FLAG_OVERRIDE_STORAGE_KEY = "contextbase:feature-flags:overrides:v1"

export const clientFeatureFlagKeys = [
  "developer.browserFlagOverrides",
] as const satisfies readonly ClientFeatureFlagKey[]

export const editableClientFeatureFlagKeys = [] as const satisfies readonly ClientFeatureFlagKey[]

export type FeatureFlagOverrideMap = Partial<Record<ClientFeatureFlagKey, boolean>>

type OverrideStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

export function getBrowserFeatureFlagOverrideStorage(): OverrideStorage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function readFeatureFlagOverrides(
  storage: Pick<Storage, "getItem"> | null,
  storageKey = FEATURE_FLAG_OVERRIDE_STORAGE_KEY,
): FeatureFlagOverrideMap {
  if (!storage) return {}
  const serialized = storage.getItem(storageKey)
  if (!serialized) return {}

  try {
    const parsed = JSON.parse(serialized) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [ClientFeatureFlagKey, boolean] =>
          isClientFeatureFlagKey(entry[0]) && typeof entry[1] === "boolean",
      ),
    )
  } catch {
    return {}
  }
}

export function writeFeatureFlagOverrides(
  storage: OverrideStorage | null,
  overrides: FeatureFlagOverrideMap,
  storageKey = FEATURE_FLAG_OVERRIDE_STORAGE_KEY,
) {
  if (!storage) return
  const entries = Object.entries(overrides).filter((entry) => typeof entry[1] === "boolean")
  if (entries.length === 0) {
    storage.removeItem(storageKey)
    return
  }
  storage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)))
}

export function mergeFeatureFlagValues({
  overrides,
  overridesEnabled,
  snapshot,
}: {
  overrides: FeatureFlagOverrideMap
  overridesEnabled: boolean
  snapshot: FeatureFlagSnapshot
}): Record<ClientFeatureFlagKey, boolean> {
  if (!overridesEnabled) return snapshot.values
  return {
    ...snapshot.values,
    ...overrides,
  }
}

export function isClientFeatureFlagKey(value: string): value is ClientFeatureFlagKey {
  return clientFeatureFlagKeys.includes(value as ClientFeatureFlagKey)
}

export function resolveFeatureFlagOverrideStorageKey(scopeKey?: string) {
  return scopeKey
    ? `${FEATURE_FLAG_OVERRIDE_STORAGE_KEY}:${scopeKey}`
    : FEATURE_FLAG_OVERRIDE_STORAGE_KEY
}
