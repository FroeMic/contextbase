import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("option-backed filter chip summaries", () => {
  test("resolve selected option values through column filter options", () => {
    const textListChipSource = source("components/applied-state-bar/TextListFilterChip.tsx")
    const idListChipSource = source("components/applied-state-bar/IdListFilterChip.tsx")

    expect(textListChipSource).toContain("summarizeOptionFilterValues")
    expect(textListChipSource).toContain("normalizeTextListFilterOptions")
    expect(textListChipSource).not.toContain("payload.values.join")

    expect(idListChipSource).toContain("summarizeOptionFilterValues")
    expect(idListChipSource).toContain("normalizeIdListFilterOptions")
    expect(idListChipSource).not.toContain("payload.ids.join")
  })
})
