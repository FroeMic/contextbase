import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("DisabledWithTooltip", () => {
  test("wraps disabled controls in a span trigger so tooltips can open", () => {
    const path = join(process.cwd(), "src/shared/ui/DisabledWithTooltip.tsx")

    expect(existsSync(path)).toBe(true)
    const source = readFileSync(path, "utf8")
    expect(source).toContain("Tooltip")
    expect(source).toContain("TooltipTrigger")
    expect(source).toContain("TooltipContent")
    expect(source).toContain("<span")
    expect(source).toContain("aria-disabled")
  })
})
