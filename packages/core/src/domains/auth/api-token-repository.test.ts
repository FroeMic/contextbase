import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("Postgres API token management repository", () => {
  test("does not query copied agents for API token management", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/auth/api-token-repository.ts"), {
      encoding: "utf8",
    })

    expect(source).not.toContain("agents")
    expect(source).not.toContain("WorkspaceAgent")
    expect(source).not.toContain('principalKind, "agent"')
  })
})
