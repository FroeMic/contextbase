import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("router preload cache", () => {
  test("intent preloads stay fresh long enough for click navigation", () => {
    const routerSource = readFileSync(join(process.cwd(), "src/router.tsx"), "utf8")

    expect(routerSource).toContain("defaultPreloadStaleTime: 30_000")
  })
})
