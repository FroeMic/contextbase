import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("package exports", () => {
  test("exports workspace member contracts through the domain subpath", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      exports: Record<string, unknown>
    }

    expect(packageJson.exports).toHaveProperty("./domains/workspace-members/contract")
    expect(packageJson.exports).toHaveProperty("./domains/session-capture/contract")
  })
})
