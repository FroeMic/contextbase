import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("page hint tips button", () => {
  test("renders a compact ghost tips button that resets dismissed hints", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/page-hints/PageHintTipsButton.tsx"),
      "utf8",
    )

    expect(source).toContain("LightbulbIcon")
    expect(source).toContain("Button")
    expect(source).toContain('variant="ghost"')
    expect(source).toContain('size="xs"')
    expect(source).toContain("Show Tips")
    expect(source).toContain("clearDismissedPageHintKeys")
    expect(source).toContain("dispatchPageHintReset")
    expect(source).toContain("if (hints.length === 0) return null")
  })
})
