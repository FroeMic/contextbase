# Browser Extension Image Sync Debug

Date: 2026-06-26

## Symptom

Captured ChatGPT sessions displayed an image artifact such as `1772517912913.webp`, but the Contextbase UI rendered `Image unavailable`.

## Root Cause

There were two parser gaps:

1. The extension detected visible `<img>` elements and created image artifact rows, but only uploaded bytes for `data:` URLs. ChatGPT generated images are normally remote or blob-backed image URLs, so those artifacts reached the backend without `imageData`, produced no file upload, and therefore had no `fileObjectId`.
2. Real generated-image turns can be image-only assistant turns. The parser dropped any turn with empty text before scanning image artifacts, which produced `artifact_count = 0` for session `cps_h2riyjbadfmczljx1am1sy98`.

## Fix

Added image hydration for non-`data:` images:

- `apps/browser-extension/src/providers/image-artifacts.ts` fetches image URLs, validates image content type, preserves sensible filenames, and converts bytes for upload.
- `apps/browser-extension/src/providers/chatgpt.ts` stores an extension-only `imageFetchUrl` for visible images and strips it before sync payloads.
- `apps/browser-extension/src/providers/chatgpt.ts` now keeps media-only turns so their images can be extracted and associated with an assistant message.
- `apps/browser-extension/src/content-scripts/chatgpt.ts` hydrates visible image artifacts before manual and automatic sync messages.
- `apps/browser-extension/src/sync.ts` also fetches `imageFetchUrl` as a fallback before creating the file upload.
- `apps/browser-extension/wxt.config.ts` adds broad HTTPS host permission for provider/CDN image fetches during this PoC.

## Evidence

Regression tests failed before implementation:

- `hydrateChatGptImageArtifacts` did not exist.
- Sync sent `imageFetchUrl` artifacts directly to `/sync/manual` without fetching/uploading them.
- Image-only assistant turns were dropped by the parser, producing `artifact_count = 0`.

Verification after implementation:

- `pnpm --filter @contextbase/browser-extension test`
- `pnpm --filter @contextbase/browser-extension typecheck`
- `pnpm lint`
- `pnpm --filter @contextbase/browser-extension e2e`

The E2E fixture now uses a remote `.webp` image URL and verifies the built extension uploads it before syncing the artifact reference.

## Status

DONE
