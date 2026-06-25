import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("settings pages", () => {
  test("canonical workspace settings routes render dedicated page components", () => {
    const routeExpectations = [
      ["src/routes/app/$workspaceSlug/settings/account/profile.tsx", "AccountProfileSettingsPage"],
      [
        "src/routes/app/$workspaceSlug/settings/account/security.tsx",
        "AccountSecuritySettingsPage",
      ],
      [
        "src/routes/app/$workspaceSlug/settings/workspace/general.tsx",
        "WorkspaceGeneralSettingsPage",
      ],
      [
        "src/routes/app/$workspaceSlug/settings/workspace/members.tsx",
        "WorkspaceMembersSettingsPage",
      ],
      ["src/routes/app/$workspaceSlug/settings/developers/api.tsx", "WorkspaceApiSettingsPage"],
      ["src/routes/app/$workspaceSlug/settings/developers/mcp.tsx", "DeveloperMcpSettingsPage"],
      ["src/routes/app/$workspaceSlug/settings/developers/cli.tsx", "DeveloperCliSettingsPage"],
    ] as const

    for (const [routePath, componentName] of routeExpectations) {
      const routeSource = source(routePath)
      expect(routeSource).toContain(componentName)
      expect(routeSource).toContain("/app/$workspaceSlug/settings")
      expect(routeSource).not.toContain("businessSlug")
    }
  })

  test("workspace settings navigation contains only Contextbase settings groups", () => {
    const navigationSource = source(
      "src/app/workspace-settings-frame/workspace-settings-navigation.ts",
    )

    for (const section of ["Account", "Workspace", "Developers"]) {
      expect(navigationSource).toContain(`section: "${section}"`)
    }

    for (const forbidden of ["Business", "Agents", "$businessSlug", "businessSlug"]) {
      expect(navigationSource).not.toContain(forbidden)
    }
  })

  test("page components compose the settings layout primitives", () => {
    const pageExpectations = [
      ["AccountProfileSettingsPage.tsx", ["Account", "Profile photo", "Name", "Email", "Theme"]],
      ["AccountSecuritySettingsPage.tsx", ["Security"]],
      [
        "WorkspaceGeneralSettingsPage.tsx",
        ["General", "Workspace name", "Workspace URL", "Workspace ID"],
      ],
      [
        "WorkspaceMembersSettingsPage.tsx",
        ["Members", "Invite member", "Email", "Role", "Pending invitations"],
      ],
      ["WorkspaceApiSettingsPage.tsx", ["API", "Workspace API keys"]],
      ["DeveloperMcpSettingsPage.tsx", ["MCP", "MCP access"]],
      ["DeveloperCliSettingsPage.tsx", ["CLI", "Command line access"]],
    ] as const

    for (const [fileName, labels] of pageExpectations) {
      const pageSource = source(`src/domains/settings/screens/${fileName}`)

      expect(pageSource).toContain("SettingsPageContent")
      expect(pageSource).toContain('className="flex flex-col gap-8"')

      for (const label of labels) {
        expect(pageSource).toContain(label)
      }
    }
  })

  test("settings rows stack label and controls on mobile", () => {
    const layoutSource = source("src/domains/settings/components/SettingsLayout.tsx")

    expect(layoutSource).toContain("flex-col")
    expect(layoutSource).toContain("items-stretch")
    expect(layoutSource).toContain("max-sm:flex-col")
    expect(layoutSource).toContain("max-sm:items-stretch")
    expect(layoutSource).toContain("[&_[data-slot=button]]:text-sm")
  })

  test("workspace settings general page keeps workspace identity workspace-scoped", () => {
    const pageSource = source("src/domains/settings/screens/WorkspaceGeneralSettingsPage.tsx")

    expect(pageSource).toContain("queries.activeWorkspace")
    expect(pageSource).toContain("trpc.settings.workspace.updateSlug.useMutation")
    expect(pageSource).not.toContain("businessSlug")
    expect(pageSource).not.toContain("trpc.settings.business")
  })
})
