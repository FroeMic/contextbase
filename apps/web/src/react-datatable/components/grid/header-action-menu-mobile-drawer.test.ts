import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("mobile column header action menu", () => {
  test("opens header column actions in a mobile drawer while preserving the desktop menu", () => {
    const headerSource = datatableSource("components/grid/HeaderActionMenu.tsx")
    const mobileSource = datatableSource("components/grid/MobileHeaderActionDrawerContent.tsx")
    const filterEditorSource = datatableSource("features/filters/MobileColumnFilterEditor.tsx")

    expect(headerSource).toContain("useIsMobile")
    expect(headerSource).toContain("DatatableMobileDrawerNavigator")
    expect(headerSource).toContain("useMobileHeaderActionDrawerPages")
    expect(headerSource).toContain("DropdownMenu")

    expect(mobileSource).toContain('type HeaderActionDrawerPageId = "root" | "filter" | "resize"')
    expect(mobileSource).toContain("MobileColumnFilterEditor")
    expect(mobileSource).toContain('push("filter"')
    expect(mobileSource).toContain('push("resize"')
    expect(mobileSource).toContain("MobileHeaderFilterPage")
    expect(mobileSource).toContain("MobileHeaderResizePage")
    expect(mobileSource).toContain("MobileColumnResizeEditor")
    expect(mobileSource).toContain("h-11")
    expect(mobileSource).toContain("text-sm")
    expect(filterEditorSource).toContain("TextListFilterEditor")
    expect(filterEditorSource).toContain("DateFilterEditor")
    expect(filterEditorSource).toContain("TextFilterEditor")
    expect(filterEditorSource).toContain("NumberFilterEditor")
    expect(filterEditorSource).toContain("BooleanFilterEditor")
    expect(filterEditorSource).toContain("IdListFilterEditor")
  })

  test("orders mobile column header actions by resize, filter, hide, sorting, then remove sorting", () => {
    const source = datatableSource("components/grid/MobileHeaderActionDrawerContent.tsx")
    const orderedActions = [
      'push("resize"',
      'push("filter"',
      "options.onHide",
      "options.onSort(false)",
      "options.onSort(true)",
      "Remove Sorting",
    ]
    const indexes = orderedActions.map((action) => source.indexOf(action))

    for (const index of indexes) {
      expect(index).toBeGreaterThan(-1)
    }

    expect(indexes).toEqual([...indexes].sort((left, right) => left - right))
  })
})
