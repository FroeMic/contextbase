import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { MarkdownViewer } from "./MarkdownViewer"

describe("MarkdownViewer", () => {
  test("renders stored markdown through the read-only Tiptap static renderer", () => {
    const componentPath = join(process.cwd(), "src/shared/markdown/MarkdownViewer.tsx")

    expect(existsSync(componentPath)).toBe(true)

    const source = readFileSync(componentPath, "utf8")

    expect(source).toContain('from "@tiptap/static-renderer/pm/react"')
    expect(source).toContain("renderToReactElement")
    expect(source).toContain("markdownManager.parse")
    expect(source).not.toContain("useEditor(")
    expect(source).not.toContain("new Editor")
    expect(source).not.toContain("getJSON")
    expect(source).not.toContain("getHTML")
  })

  test("renders standalone Contextbase file links as file cards", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          markdown:
            "[discussion.md](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).toContain('data-vertical-file-card="true"')
    expect(html).toContain("discussion.md")
    expect(html).toContain('data-file-kind="markdown"')
    expect(html).toContain("Open preview")
    expect(html).toContain("Download")
  })

  test("classifies standalone Contextbase file links from inline metadata before falling back to the label", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          inlineFiles: [
            {
              byteSize: 128,
              contentType: "text/markdown",
              fileId: "file_doc",
              originalFilename: "discussion.md",
              referenceId: "ref_123",
            },
          ],
          markdown: "[Spec](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).toContain('data-vertical-file-card="true"')
    expect(html).toContain('data-file-kind="markdown"')
    expect(html).toContain("Open preview")
  })

  test("carries inline metadata on file targets for deep-linked preview opens", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          fileOpenIntent: { open: true, referenceId: "ref_123" },
          inlineFiles: [
            {
              byteSize: 128,
              contentType: "text/markdown",
              fileId: "file_doc",
              originalFilename: "discussion.md",
              referenceId: "ref_123",
            },
          ],
          markdown: "[Spec](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).toContain('data-file-content-type="text/markdown"')
    expect(html).toContain('data-file-original-filename="discussion.md"')
  })

  test("renders Contextbase image markdown as previewable inline images", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          markdown:
            "![diagram](https://uploads.contextbase.localhost/file_img/content#v-ref=ref_123&v-width=0.72)",
        }),
      ),
    )

    expect(html).toContain('data-contextbase-inline-image="true"')
    expect(html).toContain("Open image preview")
    expect(html).toContain('href="/api/files/file_img/content"')
    expect(html).toContain('src="/api/files/file_img/content"')
    expect(html).toContain('data-file-ref="ref_123"')
    expect(html).toContain(
      'data-file-url="https://uploads.contextbase.localhost/file_img/content#v-ref=ref_123&amp;v-width=0.72"',
    )
  })

  test("renders non-image Contextbase file image syntax as a file card", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          markdown:
            "![discussion.md](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).toContain('data-vertical-file-card="true"')
    expect(html).toContain('data-file-kind="markdown"')
    expect(html).toContain("discussion.md")
    expect(html).not.toContain('class="contextbase-inline-image"')
    expect(html).not.toContain("Open image preview")
  })

  test("renders unsupported Contextbase file image syntax as a file card without preview", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          markdown:
            "![document.pdf](https://uploads.contextbase.localhost/file_pdf/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).toContain('data-vertical-file-card="true"')
    expect(html).toContain('data-file-kind="unsupported"')
    expect(html).toContain("document.pdf")
    expect(html).not.toContain('class="contextbase-inline-image"')
    expect(html).not.toContain("Open preview")
  })

  test("keeps non-standalone file links as normal markdown links", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        createElement(MarkdownViewer, {
          markdown:
            "See [discussion.md](https://uploads.contextbase.localhost/file_doc/content#v-ref=ref_123)",
        }),
      ),
    )

    expect(html).not.toContain('data-vertical-file-card="true"')
    expect(html).toContain("<p>See ")
  })
})

function withQueryClient(children: React.ReactElement) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children)
}
