import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("mobile applied state chips", () => {
  test("open active sorting and filter chips in mobile drawers while preserving desktop popovers", () => {
    const sortingChipSource = datatableSource("components/applied-state-bar/SortingChip.tsx")
    const filterChipSource = datatableSource("components/applied-state-bar/FilterChip.tsx")
    const sortingDrawerSource = datatableSource(
      "components/applied-state-bar/MobileSortingDrawerContent.tsx",
    )
    const filterDrawerSource = datatableSource(
      "components/applied-state-bar/MobileFilterChipDrawerContent.tsx",
    )
    const filterEditorSource = datatableSource("features/filters/MobileColumnFilterEditor.tsx")

    expect(sortingChipSource).toContain("useIsMobile")
    expect(sortingChipSource).toContain("DatatableMobileDrawerNavigator")
    expect(sortingChipSource).toContain("useMobileSortingDrawerPages")
    expect(sortingChipSource).toContain("Popover")

    expect(filterChipSource).toContain("useIsMobile")
    expect(filterChipSource).toContain("DatatableMobileDrawerNavigator")
    expect(filterChipSource).toContain("useMobileFilterChipDrawerPages")
    expect(filterChipSource).toContain("TextFilterChip")

    expect(sortingDrawerSource).toContain("DatatableMobileSelectorProvider")
    expect(sortingDrawerSource).toContain("SortingPopover")
    expect(sortingDrawerSource).toContain('variant="mobile"')

    expect(filterDrawerSource).toContain("MobileColumnFilterEditor")
    expect(filterEditorSource).toContain("TextListFilterEditor")
    expect(filterEditorSource).toContain("DateFilterEditor")
    expect(filterEditorSource).toContain("TextFilterEditor")
    expect(filterEditorSource).toContain("NumberFilterEditor")
    expect(filterEditorSource).toContain("BooleanFilterEditor")
    expect(filterEditorSource).toContain("IdListFilterEditor")
  })

  test("renders visible sorting and filter chips as full pills on desktop and mobile", () => {
    const sources = [
      datatableSource("components/applied-state-bar/SortingChip.tsx"),
      datatableSource("components/applied-state-bar/FilterChip.tsx"),
      datatableSource("components/applied-state-bar/TextFilterChip.tsx"),
      datatableSource("components/applied-state-bar/NumberFilterChip.tsx"),
      datatableSource("components/applied-state-bar/DateFilterChip.tsx"),
      datatableSource("components/applied-state-bar/OptionListFilterChip.tsx"),
      datatableSource("components/applied-state-bar/GenericFilterChip.tsx"),
    ]

    for (const source of sources) {
      expect(source).toContain("rounded-full")
    }
  })
})
