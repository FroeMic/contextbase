import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import type { DatatableQueryOptionDeclaration } from "../../types/props.types"
import { resolveBooleanQueryOptionValue } from "./QueryOptionsSection"

describe("datatable query options display section", () => {
  test("resolves boolean query option defaults and stored values", () => {
    const declaration: DatatableQueryOptionDeclaration = {
      key: "showSubtasks",
      label: "Show subtasks",
      type: "boolean",
      defaultValue: false,
    }

    expect(resolveBooleanQueryOptionValue({}, declaration)).toBe(false)
    expect(resolveBooleanQueryOptionValue({ showSubtasks: true }, declaration)).toBe(true)
    expect(resolveBooleanQueryOptionValue({ showSubtasks: "yes" }, declaration)).toBe(false)
  })

  test("renders generic query options without importing task domain code", () => {
    const source = readFileSync(new URL("./QueryOptionsSection.tsx", import.meta.url), "utf8")

    expect(source).toContain("DatatableQueryOptionDeclaration")
    expect(source).toContain("setQueryOption")
    expect(source).toContain("Switch")
    expect(source).not.toContain("domains/tasks")
    expect(source).not.toContain("showSubtasks")
  })

  test("display popover wires declared query options into the reset flow", () => {
    const source = readFileSync(new URL("./DisplayOptionsPopover.tsx", import.meta.url), "utf8")

    expect(source).toContain("QueryOptionsSection")
    expect(source).toContain("queryOptions")
    expect(source).toContain("resetQueryOptions")
  })
})
