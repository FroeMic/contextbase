import { describe, expect, test } from "vitest"

import {
  appendMarkdownFileReferences,
  appendMarkdownImageReferences,
  filesFromTransfer,
  markdownFileReferenceForUpload,
  markdownImageReferenceForUpload,
} from "./markdown-editor-upload"

describe("markdown editor inline uploads", () => {
  test("creates markdown image references from uploaded browser file URLs", () => {
    const reference = markdownFileReferenceForUpload(
      new File(["image"], "Screenshot 1.png", { type: "image/png" }),
      {
        assetUrl: "https://uploads.example.com/fil_123/content",
        contentUrl: "/api/files/fil_123/content",
        originalFilename: "Screenshot 1.png",
      },
    )

    expect(reference).toBe("![Screenshot 1.png](https://uploads.example.com/fil_123/content)")
  })

  test("creates standalone file links for non-image uploads", () => {
    const reference = markdownFileReferenceForUpload(
      new File(["notes"], "discussion.md", { type: "text/markdown" }),
      { contentUrl: "/api/files/fil_md/content", originalFilename: "discussion.md" },
    )

    expect(reference).toBe("[discussion.md](/api/files/fil_md/content)")
  })

  test("prefers server-provided markdown snippets when present", () => {
    expect(
      markdownFileReferenceForUpload(new File(["image"], "image.png", { type: "image/png" }), {
        contentUrl: "/api/files/fil_img/content",
        markdownImage: "![image.png](/api/files/fil_img/content#v-ref=server)",
        markdownLink: "[image.png](/api/files/fil_img/content#v-ref=server)",
      }),
    ).toBe("![image.png](/api/files/fil_img/content#v-ref=server)")

    expect(
      markdownFileReferenceForUpload(
        new File(["notes"], "discussion.md", { type: "text/markdown" }),
        {
          contentUrl: "/api/files/fil_md/content",
          markdownLink: "[discussion.md](/api/files/fil_md/content#v-ref=server)",
        },
      ),
    ).toBe("[discussion.md](/api/files/fil_md/content#v-ref=server)")
  })

  test("sanitizes standalone file link labels", () => {
    const reference = markdownFileReferenceForUpload(
      new File(["zip"], "Orbital [Gateway].zip", { type: "application/zip" }),
      { contentUrl: "/api/files/fil_zip/content", originalFilename: "Orbital [Gateway].zip" },
    )

    expect(reference).toBe("[Orbital (Gateway).zip](/api/files/fil_zip/content)")
  })

  test("appends uploaded file references without creating visible file attachments", () => {
    expect(
      appendMarkdownFileReferences("Existing body", ["![Screenshot](/api/files/fil_123/content)"]),
    ).toBe("Existing body\n\n![Screenshot](/api/files/fil_123/content)")
  })

  test("keeps the image-specific helpers available for existing callers", () => {
    expect(
      markdownImageReferenceForUpload(new File(["image"], "image.png", { type: "image/png" }), {
        contentUrl: "/api/files/fil_123/content",
      }),
    ).toBe("![image.png](/api/files/fil_123/content)")
    expect(appendMarkdownImageReferences("", ["![image.png](/api/files/fil_123/content)"])).toBe(
      "![image.png](/api/files/fil_123/content)",
    )
  })

  test("extracts all files from paste or drop transfer data", () => {
    const image = new File(["image"], "image.png", { type: "image/png" })
    const text = new File(["text"], "note.txt", { type: "text/plain" })
    const transfer = {
      files: [],
      items: [
        { getAsFile: () => image, kind: "file" },
        { getAsFile: () => text, kind: "file" },
      ],
    } as unknown as DataTransfer

    expect(filesFromTransfer(transfer)).toEqual([image, text])
  })
})
