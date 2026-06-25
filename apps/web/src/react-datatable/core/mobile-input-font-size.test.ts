import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("datatable mobile input sizing", () => {
  test("keeps compact datatable inputs at 16px on mobile with Tailwind classes", () => {
    const datatableStyles = readFileSync(
      join(process.cwd(), "src/react-datatable/styles/datatable.css"),
      "utf8",
    )
    const inputClassesSource = readFileSync(
      join(process.cwd(), "src/react-datatable/shared/styles/input-classes.ts"),
      "utf8",
    )
    const quickSearchSource = readFileSync(
      join(process.cwd(), "src/react-datatable/components/toolbar/QuickSearch.tsx"),
      "utf8",
    )
    const filterButtonSource = readFileSync(
      join(process.cwd(), "src/react-datatable/components/toolbar/FilterButton.tsx"),
      "utf8",
    )
    const savedViewsSource = readFileSync(
      join(process.cwd(), "src/react-datatable/features/saved-views/MobileViewsDrawerContent.tsx"),
      "utf8",
    )
    const overlaySearchSource = readFileSync(
      join(process.cwd(), "src/react-datatable/shared/hooks/use-overlay-search-input.ts"),
      "utf8",
    )
    const filterEditorSources = [
      "src/react-datatable/features/filters/editors/DateFilterEditor.tsx",
      "src/react-datatable/features/filters/editors/NumberFilterEditor.tsx",
      "src/react-datatable/features/filters/editors/OptionListFilterEditor.tsx",
      "src/react-datatable/features/filters/editors/TextFilterEditor.tsx",
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"))

    expect(datatableStyles).not.toContain("font-size: 16px !important")
    expect(inputClassesSource).toContain("DATATABLE_INLINE_INPUT_CLASS")
    expect(inputClassesSource).toContain("text-base")
    expect(inputClassesSource).toContain("placeholder:text-base")
    expect(inputClassesSource).toContain("sm:text-xs")
    expect(inputClassesSource).toContain("md:text-xs")
    expect(inputClassesSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(inputClassesSource).toContain("h-10")
    expect(inputClassesSource).toContain("px-4")
    expect(inputClassesSource).not.toContain("h-12")
    expect(inputClassesSource).not.toContain("px-5")
    expect(inputClassesSource).toContain("rounded-[9999px]")
    expect(inputClassesSource).toContain("sm:rounded-[9999px]")
    expect(inputClassesSource).not.toContain("sm:rounded-md")
    expect(quickSearchSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(filterButtonSource).toContain("h-11 rounded-full px-4 text-sm")
    expect(filterButtonSource).toContain("rounded-full px-3.5")
    expect(savedViewsSource).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(overlaySearchSource).toContain("DATATABLE_INLINE_INPUT_CLASS")
    expect(quickSearchSource).not.toContain("text-xs!")
    for (const source of filterEditorSources) {
      expect(source).not.toContain("!text-xs")
      expect(source).not.toContain("placeholder:text-xs")
    }
  })
})
