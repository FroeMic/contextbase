import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("settings layout primitives", () => {
  const sourcePath = join(process.cwd(), "src/domains/settings/components/SettingsLayout.tsx")

  test("copies Otto's main-column primitive API and spacing contract", () => {
    const source = readFileSync(sourcePath, "utf8")

    for (const exportName of [
      "SettingsPage",
      "SettingsPageContent",
      "SettingsPageTitle",
      "SettingsSection",
      "SettingsSectionTitle",
      "SettingsSectionDescription",
      "SettingsCard",
      "SettingsRow",
      "SettingsRowLabel",
      "SettingsRowTitle",
      "SettingsRowDescription",
    ]) {
      expect(source).toContain(`function ${exportName}`)
    }

    expect(source).toContain("w-full max-w-2xl")
    expect(source).toContain("text-2xl font-semibold tracking-tight")
    expect(source).toContain("flex flex-col gap-3")
    expect(source).toContain(
      "rounded-lg border border-border bg-card text-card-foreground divide-y divide-border",
    )
    expect(source).toContain("flex items-center justify-between gap-4 px-5 py-5")
    expect(source).toContain("flex min-w-0 flex-col gap-0.5")
  })
})
