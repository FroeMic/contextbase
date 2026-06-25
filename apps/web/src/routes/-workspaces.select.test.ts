import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("workspace selection route", () => {
  test("implements the workspace-only selection flow", () => {
    const source = readFileSync(
      join(process.cwd(), "src/domains/auth/screens/WorkspaceSelectPage.tsx"),
      "utf8",
    )

    expect(source).toContain("Choose workspace")
    expect(source).toContain("rememberWorkspaceSelection")
    expect(source).toContain("selectWorkspaceRedirect")
    expect(source).not.toContain("selectedWorkspaceSession")
    expect(source).not.toContain("Choose business")
    expect(source).not.toContain("selectBusinessRedirect")
  })
})
