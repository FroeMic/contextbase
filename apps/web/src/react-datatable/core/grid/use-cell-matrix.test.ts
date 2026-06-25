import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("useCellMatrix", () => {
  test("rebuilds when visible columns change, not just when rows change", () => {
    const source = readFileSync(
      join(process.cwd(), "src/react-datatable/core/grid/use-cell-matrix.ts"),
      "utf8",
    )

    expect(source).toContain("getVisibleLeafColumns")
    expect(source).toContain("visibleColumnSignature")
    expect(source).toContain("[rows, visibleColumnSignature]")
  })
})
