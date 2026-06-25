import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("workspace frame composition", () => {
  test("workspace frame exists and is used by the workspace app route", () => {
    expect(existsSync(join(process.cwd(), "src/app/workspace-frame/WorkspaceFrame.tsx"))).toBe(true)

    const routeSource = source("src/routes/app/$workspaceSlug/route.tsx")
    expect(routeSource).toContain("WorkspaceFrame")
    expect(routeSource).not.toContain("component: Outlet")
  })

  test("workspace frame is composed from app frame primitives and generic workspace navigation", () => {
    const frameSource = source("src/app/workspace-frame/WorkspaceFrame.tsx")

    expect(frameSource).toContain("AppFrameViewport")
    expect(frameSource).toContain("AppFrameStage")
    expect(frameSource).toContain("SidebarProvider")
    expect(frameSource).toContain("SidebarInset")
    expect(frameSource).toContain("AppFrameHeader")
    expect(frameSource).toContain("AppFrameContent")
    expect(frameSource).toContain("WorkspaceSwitcherMenu")
    expect(frameSource).toContain("Overview")
    expect(frameSource).toContain("activeWorkspaceSlug")
    expect(frameSource).not.toContain("BusinessMenuButton")
    expect(frameSource).not.toContain("BusinessDockButton")
    expect(frameSource).not.toContain("BusinessMobileDock")
    expect(frameSource).not.toContain("selectBusiness")
    expect(frameSource).not.toContain("businessSwitchTargets")
    expect(frameSource).not.toContain("activeBusiness")
  })

  test("workspace sidebar keeps shell controls", () => {
    const frameSource = source("src/app/workspace-frame/WorkspaceFrame.tsx")

    expect(frameSource).toContain('data-slot="workspace-switcher-menu"')
    expect(frameSource).toContain("DropdownMenuTrigger")
    expect(frameSource).toContain("Switch Workspace")
    expect(frameSource).toContain("Settings")
    expect(frameSource).toContain('to="/app/$workspaceSlug/settings"')
    expect(frameSource).toContain("Logout")
  })
})
