import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("floating preview overlay contract", () => {
  test("marks the preview portal so app shell body styling does not capture it", () => {
    const previewSource = readFileSync(
      join(
        process.cwd(),
        "src/react-datatable/features/floating-preview/FloatingPreview.tsx",
      ),
      "utf8",
    )
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(previewSource).toContain('data-slot="datatable-preview-portal"')
    expect(previewSource).toContain("createPortal")
    expect(rootSource).toContain(':not([data-slot="datatable-preview-portal"])')
  })
})
