import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("datatable mobile display drawer", () => {
  test("branches DisplayOptionsButton to a mobile drawer navigator while preserving desktop popover", () => {
    const source = datatableSource("components/toolbar/DisplayOptionsButton.tsx")

    expect(source).toContain("useIsMobile")
    expect(source).toContain("DatatableMobileDrawerNavigator")
    expect(source).toContain("useMobileDisplayDrawerPages")
    expect(source).toContain("Popover")
  })

  test("routes nested searchable dropdowns through the mobile display drawer selector page", () => {
    const contentSource = datatableSource("features/display-options/MobileDisplayDrawerContent.tsx")
    const dropdownSource = datatableSource("components/ui/searchable-dropdown.tsx")

    expect(contentSource).toContain('type DisplayDrawerPageId = "root" | "selector"')
    expect(contentSource).toContain("DatatableMobileSelectorProvider")
    expect(contentSource).toContain("DisplayOptionsPopover")
    expect(contentSource).toContain('push("selector"')
    expect(contentSource).toContain("pop()")

    expect(dropdownSource).toContain("useDatatableMobileSelector")
    expect(dropdownSource).toContain("openSelector")
    expect(dropdownSource).toContain("cloneElement")
  })

  test("uses mobile sizing for display drawer rows and nested selector search", () => {
    const contentSource = datatableSource("features/display-options/MobileDisplayDrawerContent.tsx")
    const popoverSource = datatableSource("features/display-options/DisplayOptionsPopover.tsx")
    const groupingSource = datatableSource("features/display-options/GroupingSection.tsx")
    const orderingSource = datatableSource("features/display-options/OrderingSection.tsx")
    const freezeSource = datatableSource("features/display-options/FreezeColumnsSection.tsx")
    const displaySettingsSource = datatableSource(
      "features/display-options/DisplaySettingsSection.tsx",
    )
    const queryOptionsSource = datatableSource("features/display-options/QueryOptionsSection.tsx")

    expect(contentSource).toContain('variant="mobile"')
    expect(contentSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(contentSource).not.toContain("inline-input h-9 border-none bg-transparent")
    expect(contentSource).toContain("h-11")
    expect(contentSource).toContain("text-sm")
    expect(popoverSource).toContain('variant?: "default" | "mobile"')
    expect(groupingSource).toContain('variant?: "default" | "mobile"')
    expect(groupingSource).toContain("h-9")
    expect(groupingSource).toContain("rounded-full")
    expect(groupingSource).toContain("text-sm")
    expect(orderingSource).toContain('variant?: "default" | "mobile"')
    expect(orderingSource).toContain("h-9")
    expect(orderingSource).toContain("rounded-full")
    expect(orderingSource).toContain("text-sm")
    expect(freezeSource).toContain('variant?: "default" | "mobile"')
    expect(freezeSource).toContain("h-9")
    expect(freezeSource).toContain("rounded-full")
    expect(freezeSource).toContain("text-sm")
    expect(displaySettingsSource).toContain('variant?: "default" | "mobile"')
    expect(displaySettingsSource).toContain("text-sm")
    expect(queryOptionsSource).toContain('variant?: "default" | "mobile"')
    expect(queryOptionsSource).toContain("text-sm")
  })

  test("uses fully rounded column visibility chips on mobile and desktop", () => {
    const sectionSource = datatableSource("features/column-visibility/ColumnVisibilitySection.tsx")
    const toggleSource = datatableSource("features/column-visibility/ColumnVisibilityToggle.tsx")

    expect(sectionSource).toContain("inline-flex max-w-full items-center rounded-full border")
    expect(sectionSource).toContain("pointer-events-none rounded-full")
    expect(toggleSource).toContain("h-6 justify-start rounded-full")
  })
})
