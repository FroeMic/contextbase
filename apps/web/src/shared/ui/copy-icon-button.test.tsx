import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("copy icon button", () => {
  test("copies a value, swaps to a check icon, and resets like the goal id chip", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/copy-icon-button.tsx"), "utf8")

    expect(source).toContain("navigator.clipboard")
    expect(source).toContain("Check")
    expect(source).toContain("Copy")
    expect(source).toContain("setIsCopied(true)")
    expect(source).toContain("setTimeout")
    expect(source).toContain("setIsCopied(false)")
    expect(source).toContain("scale-110 text-green-600")
  })
})
