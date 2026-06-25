import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("popup motion", () => {
  test("keeps frequently used popup primitives instant", () => {
    const files = [
      "src/shared/ui/popover.tsx",
      "src/shared/ui/dropdown-menu.tsx",
      "src/shared/ui/select.tsx",
      "src/shared/ui/combobox.tsx",
    ]

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8")

      expect(source).not.toContain("data-open:animate-in")
      expect(source).not.toContain("data-closed:animate-out")
      expect(source).not.toContain("zoom-in-95")
      expect(source).not.toContain("zoom-out-95")
      expect(source).not.toContain("slide-in-from-")
      expect(source).not.toContain("duration-100")
    }
  })
})
