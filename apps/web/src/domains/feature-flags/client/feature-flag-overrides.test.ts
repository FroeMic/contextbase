import { describe, expect, test } from "vitest"
import {
  FEATURE_FLAG_OVERRIDE_STORAGE_KEY,
  mergeFeatureFlagValues,
  readFeatureFlagOverrides,
  resolveFeatureFlagOverrideStorageKey,
  writeFeatureFlagOverrides,
} from "./feature-flag-overrides"
import { createDefaultFeatureFlagSnapshot } from "./feature-flag-snapshot"

describe("feature flag browser overrides", () => {
  test("filters persisted overrides to known boolean client flags", () => {
    const storage = new MemoryStorage()
    storage.setItem(
      FEATURE_FLAG_OVERRIDE_STORAGE_KEY,
      JSON.stringify({
        "developer.browserFlagOverrides": true,
        "unknown.flag": true,
        bad: "yes",
      }),
    )

    expect(readFeatureFlagOverrides(storage)).toEqual({
      "developer.browserFlagOverrides": true,
    })
  })

  test("only applies local overrides when the server enables browser override controls", () => {
    const snapshot = createDefaultFeatureFlagSnapshot()

    expect(
      mergeFeatureFlagValues({
        overrides: { "developer.browserFlagOverrides": true },
        overridesEnabled: false,
        snapshot,
      }),
    ).toEqual(snapshot.values)
    expect(
      mergeFeatureFlagValues({
        overrides: { "developer.browserFlagOverrides": true },
        overridesEnabled: true,
        snapshot,
      }),
    ).toEqual({
      ...snapshot.values,
      "developer.browserFlagOverrides": true,
    })
  })

  test("removes override storage when no overrides remain", () => {
    const storage = new MemoryStorage()
    const storageKey = resolveFeatureFlagOverrideStorageKey("usr_123:wrk_123")

    writeFeatureFlagOverrides(storage, { "developer.browserFlagOverrides": true }, storageKey)
    expect(storage.getItem(storageKey)).toBe('{"developer.browserFlagOverrides":true}')
    expect(storageKey).toBe(`${FEATURE_FLAG_OVERRIDE_STORAGE_KEY}:usr_123:wrk_123`)

    writeFeatureFlagOverrides(storage, {}, storageKey)
    expect(storage.getItem(storageKey)).toBeNull()
  })
})

class MemoryStorage implements Pick<Storage, "getItem" | "removeItem" | "setItem"> {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}
