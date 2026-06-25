import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("web reset server-entry surface", () => {
  test("does not expose broad domain UI endpoints outside the task golden slice", () => {
    const source = readFileSync(join(process.cwd(), "src/server-entry.ts"), "utf8")
    const removedTaskUiEndpoint = ["/api", "ui", "tasks"].join("/")

    for (const forbidden of [
      "/api/search",
      removedTaskUiEndpoint,
      "/api/ui/agents",
      "/api/ui/goals",
      "/api/ui/roles",
      "/api/ui/runtime",
      "/api/ui/users",
      "/comments",
      "/artifacts",
      "/claims",
      "/reminders",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
