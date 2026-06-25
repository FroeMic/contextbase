import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable/features/saved-views", path), "utf8")
}

describe("saved view dialog lifecycle", () => {
  test("closes the views dropdown before opening create/save-as dialogs", () => {
    const dropdownContentSource = source("ViewsDropdownContent.tsx")

    expect(dropdownContentSource).toContain("openCreateDialog")
    expect(dropdownContentSource).toContain("setIsDropdownOpen(false)")
    expect(dropdownContentSource).toContain("setIsCreateDialogOpen(true)")
    expect(dropdownContentSource).not.toContain("onClick={() => setIsCreateDialogOpen(true)}")
    expect(dropdownContentSource).not.toContain("onSaveAsNew={() => setIsCreateDialogOpen(true)}")
  })

  test("keeps saved view dialogs as siblings of the views dropdown", () => {
    const viewDropdownSource = source("DatatableViewDropdown.tsx")

    expect(viewDropdownSource).toContain("<ViewsDropdownMenu")
    expect(viewDropdownSource).toContain("<CreateViewDialog")
    expect(viewDropdownSource).toContain("<RenameViewDialog")
    expect(viewDropdownSource).toContain("<DeleteViewDialog")
    expect(viewDropdownSource.indexOf("<CreateViewDialog")).toBeGreaterThan(
      viewDropdownSource.indexOf("</ViewsDropdownMenu>"),
    )
  })
})
