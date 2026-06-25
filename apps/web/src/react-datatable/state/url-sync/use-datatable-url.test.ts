import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("useDatatableUrl popstate sync", () => {
  test("defers store updates out of the browser popstate handler", () => {
    const source = readFileSync(
      join(process.cwd(), "src/react-datatable/state/url-sync/use-datatable-url.ts"),
      "utf8",
    )

    expect(source).toContain("let popStateSyncTimeout: number | null")
    expect(source).toContain("popStateSyncTimeout = window.setTimeout")
    expect(source).toContain("window.clearTimeout(popStateSyncTimeout)")
  })
})
