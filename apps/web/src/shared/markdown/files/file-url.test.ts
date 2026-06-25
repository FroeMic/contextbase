import { describe, expect, test } from "vitest"

import {
  buildFileOpenSearchParams,
  buildFileOpenUrl,
  classifyInlineFile,
  fileUrlForClipboard,
  fileUrlForNetwork,
  isStandaloneContextbaseFileLink,
  parseContextbaseFileFragment,
  parseContextbaseFileUrl,
  parseFileOpenSearchParams,
  withContextbaseFileReference,
  withContextbaseFileWidth,
} from "./index"

describe("markdown file helpers", () => {
  test("parses Contextbase file IDs from browser, API, and uploads URLs", () => {
    expect(parseContextbaseFileUrl("/api/files/file_123/content")).toMatchObject({
      fileId: "file_123",
    })
    expect(
      parseContextbaseFileUrl("/api/v1/files/fil_legacy/content?download=1#v-ref=ref_123"),
    ).toMatchObject({
      fileId: "fil_legacy",
      refId: "ref_123",
    })
    expect(
      parseContextbaseFileUrl("https://uploads.contextbase.localhost/file_abc/original"),
    ).toMatchObject({
      fileId: "file_abc",
    })
    expect(parseContextbaseFileUrl("https://example.com/not-a-file")).toBeNull()
  })

  test("preserves v-ref and v-width fragments while producing network URLs", () => {
    const raw = "/api/files/file_123/content#v-width=0.72&v-ref=ref_old&other=keep"

    expect(parseContextbaseFileFragment(raw)).toEqual({
      refId: "ref_old",
      width: 0.72,
    })
    expect(withContextbaseFileReference(raw, "ref_new")).toBe(
      "/api/files/file_123/content#other=keep&v-ref=ref_new&v-width=0.72",
    )
    expect(withContextbaseFileWidth(raw, 1.5)).toBe(
      "/api/files/file_123/content#other=keep&v-ref=ref_old&v-width=1",
    )
    expect(fileUrlForNetwork(raw)).toBe("/api/files/file_123/content#other=keep")
  })

  test("normalizes uploads-host file URLs to same-origin browser file routes for network reads", () => {
    expect(
      fileUrlForNetwork(
        "https://uploads.staging.contextbase.localhost/file_123/content?download=1#v-ref=ref_old&other=keep",
      ),
    ).toBe("/api/files/file_123/content?download=1#other=keep")
  })

  test("turns copied browser file URLs into absolute URLs without editor fragments", () => {
    expect(
      fileUrlForClipboard("/api/files/file_123/content#v-ref=ref_123", "http://127.0.0.1:4017"),
    ).toBe("http://127.0.0.1:4017/api/files/file_123/content")
    expect(
      fileUrlForClipboard(
        "https://uploads.example.com/file_123/content#v-width=0.72",
        "http://127.0.0.1:4017",
      ),
    ).toBe("https://uploads.example.com/file_123/content")
  })

  test("classifies inline files from content type and filename", () => {
    expect(
      classifyInlineFile({ contentType: "image/png", originalFilename: "screenshot.png" }),
    ).toBe("image")
    expect(classifyInlineFile({ contentType: "text/plain", originalFilename: "notes.md" })).toBe(
      "markdown",
    )
    expect(
      classifyInlineFile({ contentType: "application/zip", originalFilename: "build.zip" }),
    ).toBe("unsupported")
  })

  test("detects standalone Contextbase file links without converting prose links", () => {
    expect(isStandaloneContextbaseFileLink("[discussion.md](/api/files/file_doc/content)")).toBe(
      true,
    )
    expect(
      isStandaloneContextbaseFileLink("See [discussion.md](/api/files/file_doc/content)"),
    ).toBe(false)
    expect(isStandaloneContextbaseFileLink("![diagram](/api/files/file_doc/content)")).toBe(false)
  })

  test("parses and serializes file open deep-link parameters", () => {
    const params = buildFileOpenSearchParams({
      attachmentId: "att_123",
      commentId: "cmt_123",
      open: false,
      referenceId: "ref_123",
    })

    expect(params.toString()).toBe("ref=ref_123&attachment=att_123&comment=cmt_123")
    expect(parseFileOpenSearchParams(params)).toEqual({
      attachmentId: "att_123",
      commentId: "cmt_123",
      open: false,
      referenceId: "ref_123",
    })
    expect(parseFileOpenSearchParams(new URLSearchParams("ref=ref_123&open=1"))).toEqual({
      attachmentId: null,
      commentId: null,
      open: true,
      referenceId: "ref_123",
    })
  })

  test("builds task detail file deep links from the current page URL", () => {
    expect(
      buildFileOpenUrl("http://127.0.0.1:4017/core-default/tasks/tsk_123?ref=old&open=1", {
        attachmentId: "att_123",
        open: false,
      }),
    ).toBe("http://127.0.0.1:4017/core-default/tasks/tsk_123?attachment=att_123")
    expect(
      buildFileOpenUrl("http://127.0.0.1:4017/core-default/tasks/tsk_123", {
        commentId: "cmt_123",
        open: true,
        referenceId: "ref_123",
      }),
    ).toBe("http://127.0.0.1:4017/core-default/tasks/tsk_123?ref=ref_123&comment=cmt_123&open=1")
  })
})
