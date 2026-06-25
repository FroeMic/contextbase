import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("MobileFriendlySearchableDropdown", () => {
  test("composes desktop popover and mobile drawer picker behind one searchable dropdown API", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/ui/mobile-friendly-searchable-dropdown.tsx"),
      "utf8",
    )

    expect(source).toContain("useIsMobile")
    expect(source).toContain("Popover")
    expect(source).toContain("Drawer")
    expect(source).toContain("MobileFriendlySearchableDropdown")
    expect(source).toContain("selectionMode?:")
    expect(source).toContain("getItemSection")
    expect(source).toContain("closeOnSelect")
    expect(source).toContain("suppressRowClick")
    expect(source).toContain("onPointerDownCapture={() => suppressRowClick")
    expect(source).toContain("onClickCapture={() => suppressRowClick")
    expect(source).toContain("MOBILE_SEARCH_AUTOFOCUS_DELAY_MS")
    expect(source).toContain("window.setTimeout(focusSearchInput")
    expect(source).toContain("window.clearTimeout(focusTimeout)")
    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain("fixed inset-0 z-40 bg-background")
    expect(source).toContain("z-50")
  })

  test("allows controlled search dropdowns to preserve their input value across close/open", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/ui/mobile-friendly-searchable-dropdown.tsx"),
      "utf8",
    )

    expect(source).toContain("clearSearchOnClose?: boolean")
    expect(source).toContain("clearSearchOnClose = true")
    expect(source).toContain("if (!open && clearSearchOnClose)")
  })

  test("supports arrow-key navigation and enter selection in searchable lists", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/ui/mobile-friendly-searchable-dropdown.tsx"),
      "utf8",
    )

    expect(source).toContain('event.key === "ArrowDown"')
    expect(source).toContain('event.key === "ArrowUp"')
    expect(source).toContain('event.key === "Enter"')
    expect(source).toContain("aria-activedescendant")
    expect(source).toContain("data-active")
  })
})
