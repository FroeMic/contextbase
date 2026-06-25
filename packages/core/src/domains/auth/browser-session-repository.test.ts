import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("browser session repository", () => {
  test("does not hydrate copied business state into browser sessions", () => {
    const source = readFileSync(
      join(process.cwd(), "src/domains/auth/browser-session-repository.ts"),
      "utf8",
    )

    expect(source).not.toContain("businessSwitchTargets")
    expect(source).not.toContain("loadBusinessSwitchTargets")
    expect(source).not.toContain("switchSessionWorkspaceByBusinessSlug")
    expect(source).not.toContain(".from(businesses)")
    expect(source).not.toContain("businessLogoFileJoinCondition")
  })
})
