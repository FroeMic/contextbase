import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("PostHog root document integration", () => {
  test("injects the server-side browser analytics config before app scripts", () => {
    const source = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(source).toContain("getBrowserPostHogBootScript")
    expect(source.indexOf("getBrowserPostHogBootScript")).toBeLessThan(
      source.indexOf("<Scripts />"),
    )
  })

  test("initializes browser analytics from app providers", () => {
    const source = readFileSync(join(process.cwd(), "src/app/providers/AppProviders.tsx"), "utf8")

    expect(source).toContain("PostHogBrowserAnalytics")
  })
})
