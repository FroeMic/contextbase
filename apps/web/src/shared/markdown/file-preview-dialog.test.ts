import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("FilePreviewDialog", () => {
  test("loads markdown preview content through React Query instead of an uncached effect fetch", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/FilePreviewDialog.tsx"),
      "utf8",
    )

    expect(source).toContain('@tanstack/react-query"')
    expect(source).toContain("useQuery")
    expect(source).toContain("queryKey:")
    expect(source).not.toContain("useEffect")
  })

  test("uses the mobile friendly dialog primitive for previews", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/FilePreviewDialog.tsx"),
      "utf8",
    )

    expect(source).toContain("MobileFriendlyDialog")
    expect(source).not.toContain('from "../ui/dialog"')
  })

  test("provides accessible descriptions for mobile drawer previews", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/FilePreviewDialog.tsx"),
      "utf8",
    )

    expect(source).toContain("MobileFriendlyDialogDescription")
    expect(source).toContain("Preview file contents and file actions.")
    expect(source).toContain("Preview image attachment.")
  })

  test("uses a real visible surface for mobile drawer previews", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/FilePreviewDialog.tsx"),
      "utf8",
    )

    expect(source).toContain("bg-popover")
    expect(source).toContain("before:hidden")
    expect(source).toContain("shadow-2xl")
  })

  test("uses a full-screen media viewer for mobile image previews", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/FilePreviewDialog.tsx"),
      "utf8",
    )

    expect(source).toContain("drawerShowHandle={false}")
    expect(source).toContain("bg-black")
    expect(source).toContain("rounded-none")
    expect(source).toContain("object-contain")
  })
})
