import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import {
  buildVisiblePropertyDropdownShortcuts,
  findPropertyDropdownShortcutOption,
  type PropertyDropdownOption,
} from "./property-dropdown"

describe("property dropdown primitive", () => {
  test("provides a reusable searchable property dropdown without domain-specific code", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/property-dropdown.tsx"), "utf8")

    expect(source).toContain("export type PropertyDropdownOption")
    expect(source).toContain("export function PropertyDropdown")
    expect(source).toContain("MobileFriendlySearchableDropdown")
    expect(source).toContain("searchPlaceholder")
    expect(source).toContain("searchValue")
    expect(source).toContain("onSearchChange")
    expect(source).toContain("const currentSearch = searchValue ?? search")
    expect(source).toContain("setCurrentSearch")
    expect(source).toContain("compact = false")
    expect(source).toContain("showChevron = false")
    expect(source).toContain("const triggerModeClassName = compact")
    expect(source).toContain("showChevron ?")
    expect(source).toContain("triggerRef")
    expect(source).toContain('document.addEventListener("keydown"')
    expect(source).toContain("isEditableShortcutTarget")
    expect(source).toContain("setOpen(true)")
    expect(source).toContain("data-property-dropdown-shortcut")
    expect(source).toContain("buildVisiblePropertyDropdownShortcuts")
    expect(source).toContain("findPropertyDropdownShortcutOption")
    expect(source).toContain("hasSearchQuery")
    expect(source).toContain("section?: string")
    expect(source).toContain("getItemSection")
    expect(source).toContain('selectionMode="single"')
    expect(source).toContain("renderTrigger")
    expect(source).not.toContain("react-datatable")
    expect(source).not.toContain("task")
    expect(source).not.toContain("priority")
    expect(source).not.toContain("status")
  })

  test("uses compact shared dropdown sizing and inset option hover states", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/property-dropdown.tsx"), "utf8")

    expect(source).toContain('widthClassName="w-60"')
    expect(source).toContain("propertyDropdownIconSlotClassName")
    expect(source).toContain("size-3.5")
    expect(source).toContain("[&_svg]:size-3.5")
    expect(source).toContain("compactChipIconSlotClassName")
    expect(source).toContain("rounded-full")
    expect(source).toContain("hover:bg-muted/55")
    expect(source).toContain("focus-visible:ring-2")
  })

  test("derives row shortcuts from the visible render order", () => {
    const options = [
      { label: "Backlog", shortcut: "1", value: "backlog" },
      { label: "Ready", shortcut: "2", value: "ready" },
      { label: "Canceled", shortcut: "8", value: "canceled" },
    ] satisfies PropertyDropdownOption[]

    const shortcuts = buildVisiblePropertyDropdownShortcuts(options, { disabled: false })

    expect(Object.fromEntries(shortcuts)).toEqual({
      backlog: "1",
      canceled: "3",
      ready: "2",
    })
  })

  test("renders numeric shortcut hints only on the desktop dropdown surface", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/property-dropdown.tsx"), "utf8")

    expect(source).toContain("renderItem={(option, { surface })")
    expect(source).toContain('surface === "desktop"')
    expect(source).toContain("visibleShortcutByValue.get(option.value)")
  })

  test("disables row shortcut display and numeric selection while searching", () => {
    const options = [
      { label: "No assignee", value: "unassigned" },
      { label: "Admin", value: "user:admin" },
    ] satisfies PropertyDropdownOption[]

    expect(buildVisiblePropertyDropdownShortcuts(options, { disabled: true }).size).toBe(0)
    expect(findPropertyDropdownShortcutOption(options, "1", { disabled: true })).toBeNull()
  })

  test("selects visible options by numeric shortcut only when available", () => {
    const options = [
      { label: "No assignee", value: "unassigned" },
      { label: "Admin", value: "user:admin" },
      { disabled: true, label: "Disabled", value: "user:disabled" },
    ] satisfies PropertyDropdownOption[]

    expect(findPropertyDropdownShortcutOption(options, "2", { disabled: false })?.value).toBe(
      "user:admin",
    )
    expect(findPropertyDropdownShortcutOption(options, "3", { disabled: false })).toBeNull()
    expect(findPropertyDropdownShortcutOption(options, "0", { disabled: false })).toBeNull()
  })
})
