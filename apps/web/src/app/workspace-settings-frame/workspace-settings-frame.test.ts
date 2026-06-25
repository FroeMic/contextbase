import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

function exists(path: string) {
  return existsSync(join(process.cwd(), path))
}

describe("workspace settings shell", () => {
  test("workspace settings frame exists and is used by the app settings route", () => {
    expect(exists("src/app/workspace-settings-frame/WorkspaceSettingsFrame.tsx")).toBe(true)

    const routeSource = source("src/routes/app/$workspaceSlug/settings/route.tsx")
    expect(routeSource).toContain("WorkspaceSettingsFrame")
    expect(routeSource).not.toContain("component: Outlet")
  })

  test("workspace settings navigation exposes retained Contextbase sections", () => {
    const navigationSource = source(
      "src/app/workspace-settings-frame/workspace-settings-navigation.ts",
    )

    for (const section of ["Account", "Workspace", "Developers"]) {
      expect(navigationSource).toContain(`section: "${section}"`)
    }
    for (const label of ["Profile", "Security", "General", "Members", "API", "MCP", "CLI"]) {
      expect(navigationSource).toContain(`label: "${label}"`)
    }

    expect(navigationSource).toContain('href: "/app/$workspaceSlug/settings/account/profile"')
    expect(navigationSource).toContain('href: "/app/$workspaceSlug/settings/developers/api"')
    expect(navigationSource).not.toContain("Business")
    expect(navigationSource).not.toContain("Agents")
    expect(navigationSource).not.toContain("businessSlug")
    expect(navigationSource).not.toContain("/$businessSlug")
  })

  test("workspace settings frame uses workspace shell primitives without business controls", () => {
    const frameSource = source("src/app/workspace-settings-frame/WorkspaceSettingsFrame.tsx")
    const sidebarSource = source("src/app/workspace-settings-frame/WorkspaceSettingsSidebar.tsx")
    const navigationSource = source(
      "src/app/workspace-settings-frame/WorkspaceSettingsNavigation.tsx",
    )

    expect(frameSource).toContain("AppFrameViewport")
    expect(frameSource).toContain("AppFrameStage")
    expect(frameSource).toContain("SidebarProvider")
    expect(frameSource).toContain("SidebarInset")
    expect(frameSource).toContain("WorkspaceSettingsSidebar")
    expect(frameSource).toContain("activeWorkspaceSlug")
    expect(sidebarSource).toContain('to="/app/$workspaceSlug"')
    expect(navigationSource).toContain("workspaceSlug: activeWorkspaceSlug")
    expect(frameSource).not.toContain("BusinessDockButton")
    expect(frameSource).not.toContain("BusinessSwitchButton")
    expect(frameSource).not.toContain("selectBusiness")
    expect(sidebarSource).not.toContain("BusinessSwitchButton")
    expect(navigationSource).not.toContain("businessSlug")
  })

  test("workspace settings canonical routes exist under the app route tree", () => {
    for (const [routePath, componentName] of [
      ["account/profile.tsx", "AccountProfileSettingsPage"],
      ["account/security.tsx", "AccountSecuritySettingsPage"],
      ["workspace/general.tsx", "WorkspaceGeneralSettingsPage"],
      ["workspace/members.tsx", "WorkspaceMembersSettingsPage"],
      ["developers/api.tsx", "WorkspaceApiSettingsPage"],
      ["developers/mcp.tsx", "DeveloperMcpSettingsPage"],
      ["developers/cli.tsx", "DeveloperCliSettingsPage"],
    ] as const) {
      const routeSource = source(`src/routes/app/$workspaceSlug/settings/${routePath}`)
      expect(routeSource).toContain("createFileRoute")
      expect(routeSource).toContain(componentName)
      expect(routeSource).toContain("/app/$workspaceSlug/settings")
      expect(routeSource).not.toContain("businessSlug")
    }
  })
})
