import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("database client", () => {
  test("defaults runtime search_path to public", () => {
    const source = readFileSync(join(process.cwd(), "src/db/client.ts"), "utf8")

    expect(source).toContain('process.env.DATABASE_SEARCH_PATH ?? "public"')
    expect(source).not.toContain('"contextbase,public"')
  })
})
