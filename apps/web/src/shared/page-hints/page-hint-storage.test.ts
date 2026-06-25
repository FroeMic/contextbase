import { describe, expect, test } from "vitest"

import {
  clearDismissedPageHintKeys,
  dismissPageHintKey,
  pageHintDismissedStorageKey,
  readDismissedPageHintKeys,
} from "./page-hint-storage"

describe("page hint storage", () => {
  test("persists dismissed page hint keys by namespace", () => {
    const storage = createMemoryStorage()

    expect(readDismissedPageHintKeys(storage, "business-brief")).toEqual(new Set())

    dismissPageHintKey(storage, "business-brief", "business-brief-intro-v1")

    expect(readDismissedPageHintKeys(storage, "business-brief")).toEqual(
      new Set(["business-brief-intro-v1"]),
    )
    expect(storage.getItem(pageHintDismissedStorageKey("business-brief"))).toBe(
      JSON.stringify(["business-brief-intro-v1"]),
    )
  })

  test("ignores invalid storage payloads without crashing", () => {
    const storage = createMemoryStorage()
    storage.setItem(pageHintDismissedStorageKey("business-brief"), "{bad json")

    expect(readDismissedPageHintKeys(storage, "business-brief")).toEqual(new Set())
  })

  test("clears dismissed page hint keys by namespace", () => {
    const storage = createMemoryStorage()
    dismissPageHintKey(storage, "business-brief", "business-brief-intro-v1")

    clearDismissedPageHintKeys(storage, "business-brief")

    expect(readDismissedPageHintKeys(storage, "business-brief")).toEqual(new Set())
    expect(storage.getItem(pageHintDismissedStorageKey("business-brief"))).toBeNull()
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}
