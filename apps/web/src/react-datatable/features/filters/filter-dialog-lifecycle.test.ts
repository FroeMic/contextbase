import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("datatable filter dialog lifecycle", () => {
  test("keeps toolbar filter editor lifecycle owned by the dropdown", () => {
    const filterButtonSource = source("components/toolbar/FilterButton.tsx")
    const filterDropdownSource = source("features/filters/FilterDropdown.tsx")

    expect(filterButtonSource).not.toContain("FilterEditorModal")
    expect(filterButtonSource).not.toContain("editorColumnId")
    expect(filterButtonSource).not.toContain("onOpenEditor")
    expect(filterDropdownSource).toContain("FilterEditorModal")
    expect(filterDropdownSource).toContain("editorColumnId")
  })

  test("keeps custom date dialogs owned by the date filter editor", () => {
    const filterButtonSource = source("components/toolbar/FilterButton.tsx")
    const dateEditorSource = source("features/filters/editors/DateFilterEditor.tsx")

    expect(dateEditorSource).not.toContain("onOpenCustomDate")
    expect(dateEditorSource).toContain('presetValue === "custom"')
    expect(dateEditorSource).toContain("<CustomDatePickerDialog")
    expect(filterButtonSource).not.toContain("CustomDatePickerDialog")
    expect(filterButtonSource).not.toContain("customDateColumnId")
  })
})
