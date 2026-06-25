import vm from "node:vm"
import { describe, expect, test } from "vitest"

import { getThemeScript } from "./theme-provider"

describe("theme provider persistence", () => {
  test("pre-paint script keeps the locally selected theme when a stale cookie exists", () => {
    const classList = new Set<string>(["light"])
    const localValues = new Map<string, string>([["vertical-ui-theme", "dark"]])
    const documentElement = {
      classList: {
        add: (value: string) => classList.add(value),
        remove: (...values: Array<string>) => {
          for (const value of values) classList.delete(value)
        },
      },
      style: { colorScheme: "" },
    }
    const context = {
      document: {
        cookie: "vertical-ui-theme=light",
        documentElement,
      },
      localStorage: {
        getItem: (key: string) => localValues.get(key) ?? null,
        setItem: (key: string, value: string) => localValues.set(key, value),
      },
      matchMedia: () => ({ matches: false }),
    }

    vm.runInNewContext(getThemeScript("vertical-ui-theme", "light"), context)

    expect(localValues.get("vertical-ui-theme")).toBe("dark")
    expect(context.document.cookie).toContain("vertical-ui-theme=dark")
    expect(classList.has("dark")).toBe(true)
    expect(classList.has("light")).toBe(false)
    expect(documentElement.style.colorScheme).toBe("dark")
  })
})
