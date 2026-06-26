## Context

The captured chats UI change adds read-only transcript routes and renders message text through `MarkdownViewer`. `MarkdownViewer` already supports Contextbase image markdown and image previews for URLs such as `/api/files/<fileId>/content#v-ref=<referenceId>`.

The session-capture domain already has artifact storage primitives:

- `packages/core/src/domains/session-capture/schema.ts` defines `captured_session_artifacts` with `artifactKind`, `capturedMessageId`, `fileObjectId`, `title`, `contentType`, and `metadataJson`.
- `packages/contracts/src/domains/session-capture/contract.ts` accepts sync artifacts with `artifactKind`, `capturedMessageId`, `fileObjectId`, `sourceArtifactKey`, and metadata.
- `packages/zero-schema/src/generated-schema.ts` includes `capturedSessionArtifacts`.

The missing current-state pieces are:

- `packages/zero-schema/src/queries.ts` has queries for sessions, messages, and sync events, but no `capturedSessionArtifacts` query.
- `apps/web/src/domains/captured-chats/components.tsx` reads sessions/messages/events only.
- Extension extraction currently syncs text/message observations, not durable image files.
- Artifact sync can reference `capturedMessageId`, but the browser extension only knows provider/source message identity before the backend upserts messages.

## Goals / Non-Goals

**Goals:**

- Capture visible images from opened supported chat sessions.
- Store captured images in Contextbase workspace-scoped file storage.
- Associate image artifacts with the correct captured message idempotently.
- Render image artifacts inline in the transcript near their source message.
- Preserve existing Otto-style transcript layout.
- Preserve workspace scoping for image reads and file access.
- Avoid provider-private hotlinks as durable display URLs.

**Non-Goals:**

- Crawling provider history/sidebar chats for images.
- Capturing images from sessions the user has not opened.
- OCR, image summarization, or semantic indexing.
- Editing or deleting captured images from the transcript UI.
- Rendering every possible non-image artifact type in this change.
- Building a gallery/search view across all images.

## Design Decisions

### Store images as Contextbase files, not provider URLs

Provider image URLs may be private, expiring, blob-backed, data URLs, or bound to provider cookies. Contextbase should copy image bytes into workspace file storage and render from Contextbase file routes.

The extension may temporarily read a visible image source from the provider DOM, but persisted artifacts must reference a Contextbase `fileObjectId`.

### Add a capture-token image upload endpoint

The browser extension has a capture token, not a browser auth session. Add a capture-token protected upload endpoint for image artifacts.

Proposed endpoint:

```http
POST /api/session-capture/files
Authorization: Bearer cbvcc_...
Content-Type: multipart/form-data

file=<binary image file>
sourceArtifactKey=<provider-stable artifact key>
sourceMessageKey=<provider-stable message key, optional>
sourceUrl=<provider page url>
contentType=<image/png | image/jpeg | image/webp | image/gif>
title=<optional alt/title>
metadataJson=<optional JSON object string>
```

Response:

```ts
type SessionCaptureFileUploadResult = {
  contentType: string
  fileObjectId: string
  originalFilename: string
  storageStatus: "available"
}
```

The endpoint must validate the capture token, derive workspace scope from the capture client, reject non-image content types for this first change, enforce an image size limit, and store files through the existing file storage boundary.

### Link artifacts by source message key during sync

The extension cannot know Contextbase `capturedMessageId` before the backend upserts messages. Extend artifact input with a source-level association:

```ts
type SessionCaptureArtifactInput = {
  artifactKind: "image" | "file" | "code" | "link" | "attachment" | "unknown"
  capturedMessageId?: string
  capturedMessageSourceKey?: string
  contentType?: string
  fileObjectId?: string
  metadataJson?: string
  sourceArtifactId?: string
  sourceArtifactKey?: string
  title?: string
}
```

During sync, the backend should upsert messages first, keep a map of `sourceMessageKey -> capturedMessageId`, and resolve `capturedMessageSourceKey` to `capturedMessageId` before upserting artifacts. If neither association is available, store the artifact session-level with `capturedMessageId = null`.

### Read artifacts through Zero

Add a query shaped like the existing message query:

```ts
capturedSessionArtifacts({
  capturedSessionId: string
  limit?: number
})
```

The query must filter by `ctx.activeWorkspaceId` and `capturedSessionId`, order deterministically by `createdAt asc, id asc` or source order if available, and return no rows when there is no active workspace.

### Render images inside the transcript

The captured chats UI should render image artifacts below the associated message content:

- Image artifacts with `fileObjectId` and image `contentType` render as thumbnails using `/api/files/<fileObjectId>/content`.
- Clicking a thumbnail opens the existing image/file preview affordance or an equivalent modal.
- Multiple images on the same message render as a compact responsive grid.
- Session-level images with no `capturedMessageId` render in a small "Session images" section at the end of the transcript.
- Artifacts without `fileObjectId` render as compact unavailable file cards, not broken images.

Inline markdown image syntax inside `contentText` or `contentJson` should continue to render through `MarkdownViewer`; do not duplicate those images as artifacts unless the artifact has a distinct source key.

### Preserve transcript ergonomics

Image rendering should follow the existing captured chat UI density:

- Images stay inside the centered `max-w-3xl` transcript column.
- User-side images align with the user bubble width and do not overflow `max-w-[85%]`.
- Assistant-side images align with assistant content and remain mostly unframed.
- Mobile layout uses one column when thumbnails would become too narrow.

## Risks / Trade-offs

- Provider pages may use CORS-protected image sources. The extension should record a clear failure artifact/status rather than store a broken image.
- Large images can make sync slow. Use explicit size limits and show unsupported/too-large artifacts without blocking text sync.
- Some provider images are generated progressively or lazy-loaded. Automatic sync should capture when the visible image has loaded, and repeated observations must be idempotent.
- Message association through source keys requires stable extraction. Tests need fixtures with repeated images, duplicate alt text, and messages without provider ids.

## File Reference

| File | Change |
|------|--------|
| `packages/contracts/src/domains/session-capture/contract.ts` | Add upload response contract and `capturedMessageSourceKey` artifact input field. |
| `packages/core/src/domains/session-capture/service.ts` | Store uploaded image files and resolve artifact source message keys during sync. |
| `packages/core/src/domains/session-capture/repository.ts` | Preserve idempotent artifact upsert behavior with file object references. |
| `packages/zero-schema/src/queries.ts` | Add workspace-scoped `capturedSessionArtifacts` query. |
| `apps/browser-extension/src/providers/chatgpt.ts` | Extract visible message images with stable artifact keys. |
| `apps/browser-extension/src/sync.ts` | Upload image files with capture token and include artifact references in sync. |
| `apps/web/src/domains/captured-chats/components.tsx` | Read and render image artifacts in transcripts. |
| `apps/web/src/shared/markdown/MarkdownViewer.tsx` | Reuse existing image rendering/preview behavior where possible; do not fork it unnecessarily. |

## Open Questions

- Should GIFs be stored/rendered in v1, or should v1 accept only PNG/JPEG/WebP?
- What initial max image size should the capture-token upload endpoint enforce?
- Should failed image captures create visible unavailable artifact cards, or only sync diagnostics?
