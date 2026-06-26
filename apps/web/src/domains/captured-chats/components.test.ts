import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("captured chats components", () => {
  test("keeps the sidebar history close to Otto's compact conversation list", () => {
    const source = componentSource()

    expect(source).toContain("CapturedChatsSidebarSection")
    expect(source).toContain("SidebarMenuButton")
    expect(source).toContain('className="h-8 gap-2 pr-2.5"')
    expect(source).toContain("size-1.5 shrink-0 rounded-full")
    expect(source).toContain("truncate")
    expect(source).toContain('to="/app/$workspaceSlug/chats/$capturedSessionId"')
  })

  test("keeps the transcript read-only and Otto-shaped", () => {
    const source = componentSource()

    expect(source).toContain("max-w-3xl")
    expect(source).toContain("gap-5 px-4 py-8 md:py-10")
    expect(source).toContain("max-w-[85%] px-4 py-3")
    expect(source).toContain("rounded-[1.15rem]")
    expect(source).toContain("MarkdownViewer")
    expect(source).not.toContain("ConversationComposer")
    expect(source).not.toContain("sendMessage")
    expect(source).not.toContain("stopMessage")
  })

  test("uses Zero read queries for captured chat data", () => {
    const source = componentSource()

    expect(source).toContain("queries.capturedSessionsByWorkspace")
    expect(source).toContain("queries.capturedSessionArtifacts")
    expect(source).toContain("queries.capturedSessionMessages")
    expect(source).toContain("queries.syncEventsByCapturedSession")
    expect(source).not.toContain("trpc.")
    expect(source).not.toContain("useMutation")
  })

  test("renders captured image artifacts from Contextbase file routes only", () => {
    const source = componentSource()

    expect(source).toContain("CapturedChatImageArtifacts")
    expect(source).toContain("/api/files/")
    expect(source).toContain("/content")
    expect(source).toContain("capturedMessageId")
    expect(source).not.toContain("providerImageUrl")
    expect(source).not.toContain("sourceUrl")
  })
})

function componentSource() {
  return readFileSync(join(process.cwd(), "src/domains/captured-chats/components.tsx"), "utf8")
}
