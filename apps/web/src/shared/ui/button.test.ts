import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("button primitive", () => {
  test("exposes an elevated variant for raised outline-style controls", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/button.tsx"), "utf8")

    expect(source).toContain("elevated:")
    expect(source).toContain("border-border")
    expect(source).toContain("bg-background")
    expect(source).toContain("shadow-")
    expect(source).toContain("hover:bg-muted")
    expect(source).toContain("dark:hover:bg-input/50")
  })
})
