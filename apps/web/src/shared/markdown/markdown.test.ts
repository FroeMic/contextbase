import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { markdownManager } from "./markdown-extensions"

describe("markdown editor integration", () => {
  test("round-trips the supported markdown features as markdown", () => {
    const markdown = [
      "# Heading",
      "",
      "This is **bold**, *italic*, ~~struck~~, and [linked](https://example.com).",
      "",
      "- Bullet one",
      "- Bullet two",
      "- [ ] Open checklist item",
      "- [x] Done checklist item",
      "",
      "1. First",
      "2. Second",
    ].join("\n")

    const result = markdownManager.serialize(markdownManager.parse(markdown))

    expect(result).toContain("# Heading")
    expect(result).toContain("**bold**")
    expect(result).toContain("*italic*")
    expect(result).toContain("~~struck~~")
    expect(result).toContain("[linked](https://example.com)")
    expect(result).toContain("- Bullet one")
    expect(result).toContain("- [ ] Open checklist item")
    expect(result).toContain("- [x] Done checklist item")
    expect(result).toContain("1. First")
  })

  test("round-trips inline-code-only list items without dropping their text", () => {
    const markdown = [
      "Artifacts:",
      "",
      "- `companies/willie-studio/areas/gtm/prospecting/contact-route-email-coverage.md`",
      "- `companies/willie-studio/areas/gtm/prospecting/contact-route-email-coverage.csv`",
    ].join("\n")

    const result = markdownManager.serialize(markdownManager.parse(markdown))

    expect(result).toContain(
      "- `companies/willie-studio/areas/gtm/prospecting/contact-route-email-coverage.md`",
    )
    expect(result).toContain(
      "- `companies/willie-studio/areas/gtm/prospecting/contact-route-email-coverage.csv`",
    )
  })

  test("round-trips fenced code blocks", () => {
    const markdown = [
      "Command:",
      "",
      "```sh",
      "./bin/vertical tasks view tsk_123 --with comments,events",
      "```",
    ].join("\n")

    const result = markdownManager.serialize(markdownManager.parse(markdown))

    expect(result).toContain("```sh")
    expect(result).toContain("./bin/vertical tasks view tsk_123 --with comments,events")
  })

  test("round-trips Contextbase image markdown with width fragments", () => {
    const markdown =
      "![diagram](https://uploads.contextbase.localhost/file_image/content#v-ref=ref_123&v-width=0.72)"

    const result = markdownManager.serialize(markdownManager.parse(markdown))

    expect(result).toBe(markdown)
  })

  test("configures Tiptap image extension with resize support", () => {
    const source = [
      readFileSync(join(process.cwd(), "src/shared/markdown/markdown-extensions.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src/shared/markdown/files/ContextbaseImage.ts"), "utf8"),
    ].join("\n")

    expect(source).toContain("@tiptap/extension-image")
    expect(source).toContain("contextbase-inline-image-frame")
    expect(source).toContain("contextbase-inline-image-resize-handle-left")
    expect(source).toContain("contextbase-inline-image-resize-handle-right")
    expect(source).toContain("setPointerCapture")
    expect(source).toContain("2 * deltaX")
    expect(source).toContain("contextbase-inline-image-preview")
    expect(source).toContain('image.addEventListener("click"')
    expect(source).toContain("deepLinkUrl")
    expect(source).toContain("buildFileOpenUrl")
    expect(source).toContain("widthRatio")
    expect(source).toContain("v-width")
  })

  test("configures Contextbase file links for editor card styling without changing markdown", () => {
    const markdown =
      "[discussion.md](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)"
    const extensionSource = [
      readFileSync(join(process.cwd(), "src/shared/markdown/markdown-extensions.ts"), "utf8"),
      readFileSync(join(process.cwd(), "src/shared/markdown/files/ContextbaseLink.ts"), "utf8"),
    ].join("\n")

    expect(markdownManager.serialize(markdownManager.parse(markdown))).toBe(markdown)
    expect(extensionSource).toContain("@tiptap/extension-link")
    expect(extensionSource).toContain("data-contextbase-file-link")
    expect(extensionSource).toContain("parseContextbaseFileUrl")
  })

  test("styles inline images as centered markdown blocks", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")

    expect(source).toContain(".markdown-content :where(img.contextbase-inline-image)")
    expect(source).toContain("display: block")
    expect(source).toContain("margin-inline: auto")
    expect(source).toContain("max-width: 100%")
    expect(source).toContain("left: -0.7rem")
    expect(source).toContain("right: -0.7rem")
    expect(source).toContain(".markdown-content :where(.contextbase-inline-image-action)")
    expect(source).toContain("background: transparent")
    expect(source).toContain("border: 0")
  })

  test("keeps the editor toolbar-free and markdown-only at the app boundary", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/MarkdownEditor.tsx"),
      "utf8",
    )

    expect(source).toContain('contentType: "markdown"')
    expect(source).toContain("editor.getMarkdown()")
    expect(source).toContain("immediatelyRender: false")
    expect(source).toContain("MarkdownLinkPopover")
    expect(source).toContain("openEditableLinkExternally")
    expect(source).toContain("removeEditableLink")
    expect(source).toContain("unsetLink")
    expect(source).toContain("getMarkRange")
    expect(source).not.toContain("BubbleMenu")
    expect(source).not.toContain("FloatingMenu")
  })

  test("renders an explicit empty editor placeholder outside Tiptap internals", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/MarkdownEditor.tsx"),
      "utf8",
    )

    expect(source).toContain("markdown-editor-placeholder")
    expect(source).toContain("isEditorEmpty")
  })

  test("renders read-only markdown without mounting an editor instance", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/markdown/MarkdownViewer.tsx"),
      "utf8",
    )

    expect(source).toContain("renderToReactElement")
    expect(source).toContain("markdownManager.parse")
    expect(source).not.toContain("useEditor")
    expect(source).not.toContain("EditorContent")
  })

  test("uses 15px as the default markdown body size", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")

    expect(source).toContain(".markdown-content")
    expect(source).toContain("font-size: 15px;")
  })
})
