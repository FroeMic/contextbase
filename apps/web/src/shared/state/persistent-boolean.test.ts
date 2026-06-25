import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"

import { localStorageBooleanAdapter, type PersistentBooleanAdapter } from "./persistent-boolean"

const originalWindow = globalThis.window

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  })
})

describe("localStorageBooleanAdapter", () => {
  test("returns null without browser storage", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    })

    expect(localStorageBooleanAdapter.read("missing")).toBeNull()
    expect(() => localStorageBooleanAdapter.write("missing", true)).not.toThrow()
  })

  test("reads booleans and treats malformed values as unavailable", () => {
    const values = new Map<string, string>()
    setStorage(values)

    values.set("open", "true")
    values.set("closed", "false")
    values.set("bad", "wat")

    expect(localStorageBooleanAdapter.read("open")).toBe(true)
    expect(localStorageBooleanAdapter.read("closed")).toBe(false)
    expect(localStorageBooleanAdapter.read("bad")).toBeNull()
    expect(localStorageBooleanAdapter.read("missing")).toBeNull()
  })

  test("writes booleans and swallows storage exceptions", () => {
    const values = new Map<string, string>()
    setStorage(values)

    localStorageBooleanAdapter.write("open", false)

    expect(values.get("open")).toBe("false")

    setStorage(values, { throwOnGet: true, throwOnSet: true })

    expect(localStorageBooleanAdapter.read("open")).toBeNull()
    expect(() => localStorageBooleanAdapter.write("open", true)).not.toThrow()
  })
})

describe("usePersistentBoolean", () => {
  test("initializes from default value and reads persisted state after mount", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/state/persistent-boolean.ts"),
      "utf8",
    )

    expect(source).toContain("useState(defaultValue)")
    expect(source).toContain("useEffect(")
    expect(source).toContain("adapter.read(key)")
    expect(source).toContain("setValue(persisted)")
  })

  test("writes through the provided adapter when changed", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/state/persistent-boolean.ts"),
      "utf8",
    )

    expect(source).toContain("adapter.write(key, nextValue)")
  })
})

function setStorage(
  values: Map<string, string>,
  options: { throwOnGet?: boolean; throwOnSet?: boolean } = {},
) {
  const storage = {
    getItem: (key: string) => {
      if (options.throwOnGet) throw new Error("storage unavailable")
      return values.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      if (options.throwOnSet) throw new Error("storage unavailable")
      values.set(key, value)
    },
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
    },
  })
}

declare global {
  var window: Window & typeof globalThis
}

void (localStorageBooleanAdapter satisfies PersistentBooleanAdapter)
