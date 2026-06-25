import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("Zero client provider bootstrap input", () => {
  test("receives the verified session instead of fetching it again", () => {
    const providerSource = readFileSync(
      join(process.cwd(), "src/domains/zero/client/ZeroClientProvider.tsx"),
      "utf8",
    )

    expect(providerSource).toContain("session: AuthSession")
    expect(providerSource).toContain("getOrCreateBrowserZero(session)")
    expect(providerSource).not.toContain("useSession")
  })

  test("workspace and workspace settings frames pass their existing session data to Zero", () => {
    const workspaceFrameSource = readFileSync(
      join(process.cwd(), "src/app/workspace-frame/WorkspaceFrame.tsx"),
      "utf8",
    )
    const workspaceSettingsFrameSource = readFileSync(
      join(process.cwd(), "src/app/workspace-settings-frame/WorkspaceSettingsFrame.tsx"),
      "utf8",
    )

    expect(workspaceFrameSource).toContain("<ZeroClientProvider session={session} zero={zero}>")
    expect(workspaceSettingsFrameSource).toContain("<ZeroClientProvider session={session}>")
  })

  test("can render immediately with an already-created Zero client", () => {
    const providerSource = readFileSync(
      join(process.cwd(), "src/domains/zero/client/ZeroClientProvider.tsx"),
      "utf8",
    )

    expect(providerSource).toContain("zero: providedZero")
    expect(providerSource).toContain("providedZero ?? getOrCreateBrowserZero(session)")
  })
})
