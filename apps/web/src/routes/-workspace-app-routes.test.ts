import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function routePath(path: string) {
  return join(process.cwd(), "src/routes", path)
}

function routeSource(path: string) {
  return readFileSync(routePath(path), "utf8")
}

describe("workspace app route tree", () => {
  test("defines workspace-scoped app and settings routes", () => {
    const routeFiles = [
      "app/route.tsx",
      "app/$workspaceSlug/route.tsx",
      "app/$workspaceSlug/index.tsx",
      "app/$workspaceSlug/settings/route.tsx",
      "app/$workspaceSlug/settings/index.tsx",
    ]

    for (const file of routeFiles) {
      expect(existsSync(routePath(file)), `${file} should exist`).toBe(true)
    }
  })

  test("workspace app routes use workspace bootstrap without copied business scope", () => {
    const helper = routeSource("app/$workspaceSlug/-workspace-route-loader.ts")
    const workspaceRoute = routeSource("app/$workspaceSlug/route.tsx")
    const workspaceIndexRoute = routeSource("app/$workspaceSlug/index.tsx")

    expect(helper).toContain("resolveWorkspaceBootstrap")
    expect(helper).toContain("sessionQueryOptions")
    expect(helper).not.toContain("requireBusinessBootstrap")
    expect(helper).not.toContain("businessSlug")

    for (const source of [workspaceRoute, workspaceIndexRoute]) {
      expect(source).toContain("/app/$workspaceSlug")
      expect(source).toContain("requireActiveWorkspaceSession")
      expect(source).not.toContain("requireBusinessBootstrap")
      expect(source).not.toContain("businessSlug")
    }
  })

  test("workspace settings route root is under the app workspace tree", () => {
    const settingsRoute = routeSource("app/$workspaceSlug/settings/route.tsx")
    const settingsIndexRoute = routeSource("app/$workspaceSlug/settings/index.tsx")

    expect(settingsRoute).toContain('createFileRoute("/app/$workspaceSlug/settings")')
    expect(settingsIndexRoute).toContain('createFileRoute("/app/$workspaceSlug/settings/")')
    expect(settingsRoute).not.toContain("businessSlug")
    expect(settingsIndexRoute).not.toContain("businessSlug")
  })

  test("workspace parent route lets settings own its shell", () => {
    const workspaceRoute = routeSource("app/$workspaceSlug/route.tsx")

    expect(workspaceRoute).toContain("useLocation")
    expect(workspaceRoute).toContain("isWorkspaceSettingsPathname")
    expect(workspaceRoute).toContain("<Outlet />")
    expect(workspaceRoute).toContain("WorkspaceFrame")
  })
})
