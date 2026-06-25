import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("datatable mobile saved views drawer", () => {
  test("branches DatatableViewDropdown to a mobile drawer navigator while preserving desktop dropdown", () => {
    const source = datatableSource("features/saved-views/DatatableViewDropdown.tsx")

    expect(source).toContain("useIsMobile")
    expect(source).toContain("DatatableMobileDrawerNavigator")
    expect(source).toContain("useMobileViewsDrawerPages")
    expect(source).toContain("ViewsDropdownMenu")
  })

  test("uses typed mobile pages for root, actions, create, rename, and delete flows", () => {
    const source = datatableSource("features/saved-views/MobileViewsDrawerContent.tsx")

    expect(source).toContain("type ViewsDrawerPageId")
    expect(source).toContain('| "delete-view"')
    expect(source).toContain('"delete-view": { viewId: string }')
    expect(source).toContain('push("view-actions"')
    expect(source).toContain('push("create-view"')
    expect(source).toContain('push("rename-view"')
    expect(source).toContain('push("delete-view"')
    expect(source).toContain("ChevronRightIcon")
    expect(source).toContain("onApplyView(view.id)")
    expect(source).toContain("MobileDeleteViewPage")
    expect(source).not.toContain("setDeleteDialogViewId(view.id)")
    expect(source).toContain("-mt-px")
    expect(source).toContain("bg-popover")
  })

  test("does not render the desktop delete alert beside the mobile drawer", () => {
    const source = datatableSource("features/saved-views/DatatableViewDropdown.tsx")
    const mobileBranch = source.slice(
      source.indexOf("if (isMobile)"),
      source.indexOf("return (", source.indexOf("if (isMobile)") + 1),
    )

    expect(mobileBranch).not.toContain("<DeleteViewDialog")
  })

  test("orders mobile view actions with rename directly above delete", () => {
    const source = datatableSource("features/saved-views/MobileViewsDrawerContent.tsx")

    expect(source.indexOf('id: "rename"')).toBeLessThan(source.indexOf('id: "delete"'))
    expect(source.indexOf('id: "delete"') - source.indexOf('id: "rename"')).toBeLessThan(260)
  })

  test("uses large rounded mobile search input styling", () => {
    const source = datatableSource("features/saved-views/MobileViewsDrawerContent.tsx")
    const inputClassesSource = datatableSource("shared/styles/input-classes.ts")

    expect(source).toContain("DATATABLE_MOBILE_SEARCH_INPUT_CLASS")
    expect(inputClassesSource).toContain("rounded-[9999px]")
    expect(inputClassesSource).toContain("sm:rounded-[9999px]")
    expect(source).not.toContain("border-b bg-popover p-2")
    expect(source).not.toContain('className="inline-input h-9 border-none bg-transparent')
  })

  test("waits until nested mobile drawer pages finish opening before focusing form inputs", () => {
    const source = datatableSource("features/saved-views/MobileViewsDrawerContent.tsx")

    expect(source).toContain("MOBILE_VIEWS_DRAWER_INPUT_FOCUS_DELAY_MS")
    expect(source).toContain("window.setTimeout")
    expect(source).toContain("focus({ preventScroll: true })")
    expect(source).not.toContain("requestAnimationFrame(() => ref.current?.focus())")
  })
})
