import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("datatable mobile filter drawer", () => {
  test("branches FilterButton to a mobile drawer navigator while preserving desktop dropdown", () => {
    const source = datatableSource("components/toolbar/FilterButton.tsx")

    expect(source).toContain("useIsMobile")
    expect(source).toContain("DatatableMobileDrawerNavigator")
    expect(source).toContain("MobileFilterDrawerContent")
    expect(source).toContain("SearchableDropdownMenu")
  })

  test("renders mobile filter pages without Radix dropdown submenus", () => {
    const source = datatableSource("features/filters/MobileFilterDrawerContent.tsx")

    expect(source).toContain('"custom-date-filter"')
    expect(source).toContain('push("text-list-filter"')
    expect(source).toContain('push("date-filter"')
    expect(source).toContain('push("custom-date-filter"')
    expect(source).toContain('push("editor-filter"')
    expect(source).not.toContain("SearchableDropdownMenuSub")
    expect(source).toContain("TextListFilterEditor")
    expect(source).toContain("DateFilterEditor")
  })

  test("uses mobile search and row sizing in filter drawer pages", () => {
    const source = datatableSource("features/filters/MobileFilterDrawerContent.tsx")
    const filterItemSource = datatableSource("features/filters/FilterItem.tsx")
    const optionListSource = datatableSource("features/filters/editors/OptionListFilterEditor.tsx")
    const textFilterSource = datatableSource("features/filters/editors/TextFilterEditor.tsx")
    const numberFilterSource = datatableSource("features/filters/editors/NumberFilterEditor.tsx")
    const dateFilterSource = datatableSource("features/filters/editors/DateFilterEditor.tsx")

    expect(source).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(source).not.toContain("inline-input h-9 border-none bg-transparent")
    expect(source).toContain('variant="mobile"')
    expect(source).toContain('closeIcon: () => "check"')
    expect(filterItemSource).toContain('variant?: "default" | "mobile"')
    expect(filterItemSource).toContain("h-11")
    expect(filterItemSource).toContain("text-sm")
    expect(optionListSource).toContain('variant?: "default" | "mobile"')
    expect(optionListSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(optionListSource).toContain("w-full")
    expect(optionListSource).toContain("h-11")
    expect(optionListSource).toContain("text-sm")
    expect(textFilterSource).toContain('variant?: "default" | "mobile"')
    expect(textFilterSource).toContain("h-10")
    expect(textFilterSource).toContain("text-base")
    expect(numberFilterSource).toContain('variant?: "default" | "mobile"')
    expect(numberFilterSource).toContain("h-10")
    expect(numberFilterSource).toContain("text-base")
    expect(dateFilterSource).toContain('variant?: "default" | "mobile"')
    expect(dateFilterSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(dateFilterSource).toContain("h-11")
    expect(dateFilterSource).toContain("text-sm")
  })

  test("uses native mobile selects for text and number operators without searchable operator popovers", () => {
    const textFilterSource = datatableSource("features/filters/editors/TextFilterEditor.tsx")
    const numberFilterSource = datatableSource("features/filters/editors/NumberFilterEditor.tsx")

    expect(textFilterSource).toContain('variant === "mobile" ? (')
    expect(textFilterSource).toContain("<select")
    expect(textFilterSource).toContain("TEXT_FILTER_MODE_OPTIONS.map")
    expect(numberFilterSource).toContain('variant === "mobile" ? (')
    expect(numberFilterSource).toContain("<select")
    expect(numberFilterSource).toContain("NUMBER_FILTER_MODE_OPTIONS.map")
  })

  test("reserves the mobile text filter match toggle slot before multiple conditions exist", () => {
    const textFilterSource = datatableSource("features/filters/editors/TextFilterEditor.tsx")

    expect(textFilterSource).toContain("const shouldShowOperatorToggle = conditions.length > 1")
    expect(textFilterSource).toContain('variant === "mobile" || shouldShowOperatorToggle')
    expect(textFilterSource).toContain("!shouldShowOperatorToggle &&")
    expect(textFilterSource).toContain("invisible pointer-events-none")
  })

  test("keeps custom date visible in the mobile date preset list", () => {
    const dateFilterSource = datatableSource("features/filters/editors/DateFilterEditor.tsx")

    expect(dateFilterSource).toContain("mobilePresets")
    expect(dateFilterSource).toContain('opt.value === "custom"')
  })

  test("opens custom date filters as a drawer page on mobile instead of a dialog", () => {
    const drawerSource = datatableSource("features/filters/MobileFilterDrawerContent.tsx")
    const dateFilterSource = datatableSource("features/filters/editors/DateFilterEditor.tsx")

    expect(drawerSource).toContain("MobileCustomDateFilterPage")
    expect(drawerSource).toContain("CustomDatePickerContent")
    expect(drawerSource).toContain("onCustomDateRequest")
    expect(dateFilterSource).toContain("onCustomDateRequest?: () => void")
    expect(dateFilterSource).toContain("onCustomDateRequest?.()")
    expect(dateFilterSource).toContain("onCustomDateRequest ? null :")
    expect(dateFilterSource).toContain("CustomDatePickerContent")
    expect(dateFilterSource).toContain('variant === "mobile"')
    expect(dateFilterSource).toContain("flex-col")
  })

  test("applies mobile text and custom date filters from the drawer header action", () => {
    const drawerSource = datatableSource("features/filters/MobileFilterDrawerContent.tsx")
    const textFilterSource = datatableSource("features/filters/editors/TextFilterEditor.tsx")
    const dateFilterSource = datatableSource("features/filters/editors/DateFilterEditor.tsx")

    expect(drawerSource).toContain("setHeaderAction")
    expect(drawerSource).toContain("onMobileHeaderActionChange")
    expect(textFilterSource).toContain("onMobileHeaderActionChange")
    expect(textFilterSource).toContain('variant === "mobile"')
    expect(textFilterSource).toContain("disabled: !canApply")
    expect(textFilterSource).toContain('variant !== "mobile"')
    expect(dateFilterSource).toContain("onMobileHeaderActionChange")
    expect(dateFilterSource).toContain("canApply")
    expect(dateFilterSource).toContain("disabled: !canApply")
    expect(dateFilterSource).toContain('variant !== "mobile"')
  })

  test("summarizes active mobile date filters and returns to root after date apply", () => {
    const drawerSource = datatableSource("features/filters/MobileFilterDrawerContent.tsx")
    const dateFilterSource = datatableSource("features/filters/editors/DateFilterEditor.tsx")

    expect(drawerSource).toContain("formatDateFilterSummary")
    expect(drawerSource).toContain("Current filter")
    expect(drawerSource).toContain("onClose={reset}")
    expect(dateFilterSource).toContain('if (variant === "mobile")')
    expect(dateFilterSource).toContain("onClose?.()")
  })

  test("uses a completion icon on filter detail drawer pages", () => {
    const source = datatableSource("components/mobile/DatatableMobileDrawerNavigator.tsx")
    const typesSource = datatableSource("components/mobile/datatable-mobile-drawer-navigation.ts")

    expect(typesSource).toContain(
      'closeIcon?: (params: TParamsByPage[TPageId]) => "check" | "close"',
    )
    expect(source).toContain(
      'aria-label={headerAction?.label ?? (effectiveCloseIcon === "check" ? "Done" : "Close")}',
    )
    expect(source).toContain("<Check")
  })
})
