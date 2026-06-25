import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("authenticated app frame placeholder", () => {
  test("provides a structural placeholder without visible loading copy", () => {
    const placeholderPath = join(process.cwd(), "src/app/frame/AppFramePlaceholder.tsx")

    expect(existsSync(placeholderPath)).toBe(true)

    const source = readFileSync(placeholderPath, "utf8")
    expect(source).toContain("AppFramePlaceholder")
    expect(source).toContain("AppFrameViewport")
    expect(source).toContain("AppFrameStage")
    expect(source).not.toContain("Loading workspace")
    expect(source).not.toContain("spinner")
  })

  test("placeholder main surface matches the borderless app surface radius", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/frame/AppFramePlaceholder.tsx"),
      "utf8",
    )

    expect(source).toContain("rounded-xl bg-background")
    expect(source).not.toContain("border border-border/50")
  })

  test("placeholder sidebar uses the real sidebar primitive so persisted collapse width applies", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/frame/AppFramePlaceholder.tsx"),
      "utf8",
    )

    expect(source).toContain("Sidebar,")
    expect(source).toContain('className="absolute h-full"')
    expect(source).toContain('collapsible="offcanvas"')
    expect(source).toContain('variant="inset"')
    expect(source).not.toContain("<aside")
  })

  test("workspace routes keep the structural placeholder available for pending shells", () => {
    const workspaceFrame = readFileSync(
      join(process.cwd(), "src/app/workspace-frame/WorkspaceFrame.tsx"),
      "utf8",
    )

    expect(existsSync(join(process.cwd(), "src/app/frame/AppFramePlaceholder.tsx"))).toBe(true)
    expect(workspaceFrame).not.toContain("Loading workspace")
  })
})
