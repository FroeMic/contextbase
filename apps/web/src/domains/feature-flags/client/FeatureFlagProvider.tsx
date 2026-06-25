"use client"

import type { ClientFeatureFlagKey } from "@contextbase/core/domains/feature-flags/service"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  type FeatureFlagOverrideMap,
  getBrowserFeatureFlagOverrideStorage,
  mergeFeatureFlagValues,
  readFeatureFlagOverrides,
  resolveFeatureFlagOverrideStorageKey,
  writeFeatureFlagOverrides,
} from "./feature-flag-overrides"
import type { FeatureFlagSnapshot } from "./feature-flag-snapshot"

type FeatureFlagContextValue = {
  clearOverrides: () => void
  overrides: FeatureFlagOverrideMap
  overridesEnabled: boolean
  serverValues: Record<ClientFeatureFlagKey, boolean>
  setOverride: (key: ClientFeatureFlagKey, value: boolean | null) => void
  snapshot: FeatureFlagSnapshot
  values: Record<ClientFeatureFlagKey, boolean>
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null)

export function FeatureFlagProvider({
  children,
  sessionKey,
  snapshot,
  storageScopeKey,
}: {
  children: ReactNode
  sessionKey: string
  snapshot: FeatureFlagSnapshot
  storageScopeKey: string
}) {
  const [frozenSnapshotState, setFrozenSnapshotState] = useState(() => ({
    sessionKey,
    snapshot,
  }))
  const frozenSnapshot =
    frozenSnapshotState.sessionKey === sessionKey ? frozenSnapshotState.snapshot : snapshot
  const overrideStorageKey = resolveFeatureFlagOverrideStorageKey(storageScopeKey)
  const [overrideState, setOverrideState] = useState(() => ({
    overrides: readFeatureFlagOverrides(getBrowserFeatureFlagOverrideStorage(), overrideStorageKey),
    storageKey: overrideStorageKey,
  }))
  const overrides =
    overrideState.storageKey === overrideStorageKey
      ? overrideState.overrides
      : readFeatureFlagOverrides(getBrowserFeatureFlagOverrideStorage(), overrideStorageKey)
  const overridesEnabled = frozenSnapshot.values["developer.browserFlagOverrides"]
  const values = useMemo(
    () => mergeFeatureFlagValues({ overrides, overridesEnabled, snapshot: frozenSnapshot }),
    [frozenSnapshot, overrides, overridesEnabled],
  )

  useEffect(() => {
    if (frozenSnapshotState.sessionKey === sessionKey) return
    setFrozenSnapshotState({ sessionKey, snapshot })
  }, [frozenSnapshotState.sessionKey, sessionKey, snapshot])

  useEffect(() => {
    if (overrideState.storageKey === overrideStorageKey) return
    setOverrideState({
      overrides: readFeatureFlagOverrides(
        getBrowserFeatureFlagOverrideStorage(),
        overrideStorageKey,
      ),
      storageKey: overrideStorageKey,
    })
  }, [overrideState.storageKey, overrideStorageKey])

  const persistOverrides = useCallback(
    (nextOverrides: FeatureFlagOverrideMap) => {
      setOverrideState({ overrides: nextOverrides, storageKey: overrideStorageKey })
      writeFeatureFlagOverrides(
        getBrowserFeatureFlagOverrideStorage(),
        nextOverrides,
        overrideStorageKey,
      )
    },
    [overrideStorageKey],
  )

  const contextValue = useMemo<FeatureFlagContextValue>(
    () => ({
      clearOverrides: () => persistOverrides({}),
      overrides: overridesEnabled ? overrides : {},
      overridesEnabled,
      serverValues: frozenSnapshot.values,
      setOverride: (key, value) => {
        const nextOverrides = { ...overrides }
        if (value === null) {
          delete nextOverrides[key]
        } else {
          nextOverrides[key] = value
        }
        persistOverrides(nextOverrides)
      },
      snapshot: frozenSnapshot,
      values,
    }),
    [frozenSnapshot, overrides, overridesEnabled, persistOverrides, values],
  )

  return <FeatureFlagContext.Provider value={contextValue}>{children}</FeatureFlagContext.Provider>
}

export function useFeatureFlag(key: ClientFeatureFlagKey) {
  return useFeatureFlags().values[key]
}

export function useFeatureFlagControls() {
  return useFeatureFlags()
}

export function useOptionalFeatureFlagControls() {
  return useContext(FeatureFlagContext)
}

function useFeatureFlags() {
  const context = useContext(FeatureFlagContext)
  if (!context) {
    throw new Error("FeatureFlagProvider is required.")
  }
  return context
}
