import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("dialog styling", () => {
  test("shared dialogs do not blur the page background and use rounded-xl surfaces", () => {
    const dialogSource = readFileSync(join(process.cwd(), "src/shared/ui/dialog.tsx"), "utf8")
    const alertDialogSource = readFileSync(
      join(process.cwd(), "src/shared/ui/alert-dialog.tsx"),
      "utf8",
    )

    expect(dialogSource).not.toContain("backdrop-blur")
    expect(alertDialogSource).not.toContain("backdrop-blur")
    expect(dialogSource).toContain("rounded-xl")
    expect(alertDialogSource).toContain("rounded-xl")
    expect(dialogSource).not.toContain("rounded-4xl bg-popover")
    expect(alertDialogSource).not.toContain("rounded-4xl bg-popover")
  })
})
