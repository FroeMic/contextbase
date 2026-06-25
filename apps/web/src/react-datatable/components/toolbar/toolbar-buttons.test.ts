import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("datatable toolbar buttons", () => {
  test("uses fully rounded triggers for views, display options, and copy link", () => {
    expect(source("src/react-datatable/features/saved-views/ViewsDropdownTrigger.tsx")).toContain(
      "relative flex min-w-0 max-w-[8.5rem] items-center gap-1.5 rounded-full px-2",
    )
    expect(source("src/react-datatable/components/toolbar/DisplayOptionsButton.tsx")).toContain(
      "flex items-center gap-1 rounded-full px-2!",
    )
    expect(source("src/react-datatable/components/toolbar/CopyLinkButton.tsx")).toContain(
      "flex items-center gap-2 rounded-full",
    )
  })

  test("uses larger mobile toolbar button tap targets without changing desktop controls", () => {
    expect(source("src/react-datatable/components/toolbar/FilterButton.tsx")).toContain(
      "h-11 rounded-full px-4 text-sm",
    )
    expect(source("src/react-datatable/components/toolbar/DisplayOptionsButton.tsx")).toContain(
      "h-9",
    )
    expect(source("src/react-datatable/features/saved-views/DatatableViewDropdown.tsx")).toContain(
      "h-9",
    )
    expect(source("src/react-datatable/components/toolbar/CopyLinkButton.tsx")).toContain(
      "max-sm:h-9 max-sm:w-9",
    )
  })
})
