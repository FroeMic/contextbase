import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("UI foundation rebuild contract", () => {
  test("has generated shadcn/Base UI primitives available before app chrome", () => {
    const requiredPrimitives = [
      "accordion",
      "alert",
      "alert-dialog",
      "avatar",
      "badge",
      "breadcrumb",
      "button",
      "checkbox",
      "command",
      "dialog",
      "dropdown-menu",
      "input",
      "label",
      "popover",
      "radio-group",
      "select",
      "separator",
      "sheet",
      "sidebar",
      "skeleton",
      "sonner",
      "switch",
      "table",
      "tabs",
      "textarea",
      "tooltip",
    ]

    const missing = requiredPrimitives.filter(
      (component) => !existsSync(join(root, `src/shared/ui/${component}.tsx`)),
    )

    expect(missing).toEqual([])
  })

  test("mounts the Sonner toaster in app providers", () => {
    const providers = source("src/app/providers/AppProviders.tsx")

    expect(providers).toContain('from "../../shared/ui/sonner"')
    expect(providers).toContain("<Toaster")
  })

  test("keeps reusable primitives on scoped transitions", () => {
    const uiFiles = readdirSync(join(root, "src/shared/ui"))
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => `src/shared/ui/${file}`)

    for (const file of uiFiles) {
      expect(source(file)).not.toContain("transition-all")
    }
  })

  test("splits app frame primitives into dedicated files", () => {
    const requiredFrameFiles = [
      "AppFrameViewport.tsx",
      "AppFrameHeightBanner.tsx",
      "AppFrameStage.tsx",
      "AppFrameMainColumn.tsx",
      "AppFrameSurface.tsx",
      "AppFrameHeader.tsx",
      "AppFrameContent.tsx",
      "AppFrameBottomDock.tsx",
      "AppFrameProvider.tsx",
      "app-frame-slots.ts",
      "app-frame-banners.ts",
      "index.ts",
    ]

    const missing = requiredFrameFiles.filter(
      (file) => !existsSync(join(root, `src/app/frame/${file}`)),
    )

    expect(missing).toEqual([])
    expect(existsSync(join(root, "src/app/frame/AppFrame.tsx"))).toBe(false)
  })

  test("keeps WorkspaceFrame as a workspace-scoped app shell", () => {
    const workspaceFrame = source("src/app/workspace-frame/WorkspaceFrame.tsx")

    expect(workspaceFrame).toContain("WorkspaceSwitcherMenu")
    expect(workspaceFrame).toContain("Overview")
    expect(workspaceFrame).toContain("activeWorkspaceSlug")
    expect(workspaceFrame).not.toContain("BusinessFrame")
    expect(workspaceFrame).not.toContain("BusinessNavigation")
  })

  test("mounts WorkspaceSettingsFrame from the workspace settings route layout", () => {
    const settingsRoute = source("src/routes/app/$workspaceSlug/settings/route.tsx")
    const workspaceFrame = source("src/app/workspace-frame/WorkspaceFrame.tsx")

    expect(settingsRoute).toContain("WorkspaceSettingsFrame")
    expect(settingsRoute).not.toContain("SettingsPage")
    expect(workspaceFrame).not.toContain("WorkspaceSettingsSidebar")
  })

  test("mounts AppFrameHeightBanner above the frame stage", () => {
    const workspaceFrame = source("src/app/workspace-frame/WorkspaceFrame.tsx")
    const settingsFrame = source("src/app/workspace-settings-frame/WorkspaceSettingsFrame.tsx")

    for (const frame of [workspaceFrame, settingsFrame]) {
      expect(frame).toContain("AppFrameHeightBanner")
      expect(frame.indexOf("AppFrameHeightBanner")).toBeLessThan(frame.indexOf("AppFrameStage"))
    }
  })
})
