## Why

Captured ChatGPT and Claude sessions often include screenshots, generated images, diagrams, pasted images, and image attachments. The current captured chats UI can render text and markdown, but it does not yet read or display `captured_session_artifacts`, and the browser extension does not have a reliable workspace-scoped image persistence path.

Image support should preserve the mirrored-session model: images are captured from sessions the user opens, stored in Contextbase-owned workspace storage, and rendered inline in the transcript. The UI must not depend on provider-private URLs, browser blob URLs, or data URLs that will disappear after the tab closes.

## What Changes

- Add image artifact capture to the browser extension for visible images in supported chat messages.
- Add a capture-token protected image upload path that stores image bytes as workspace-scoped file objects.
- Extend session-capture artifact contracts so artifacts can be linked to messages by source message key, not only by Contextbase database id.
- Add a workspace-scoped Zero query for captured session artifacts.
- Render captured image artifacts inline under the associated transcript message.
- Keep existing markdown-image rendering through `MarkdownViewer`.
- Add tests for image extraction, upload/storage, artifact-message association, Zero scoping, transcript rendering, and no-provider-hotlink behavior.

## Capabilities

### Modified Capabilities

- `captured-chats-ui`: Captured transcripts render image artifacts and inline markdown images.
- `automatic-session-sync`: Automatic sync includes visible image artifacts for supported provider pages.
- `session-capture-domain`: Session capture can store uploaded image files and associate image artifacts with captured messages.
- `web-data-access`: Adds a Zero read query for captured session artifacts scoped by active workspace and captured session.

## Impact

- Extends session-capture contracts and API routes.
- Extends browser-extension extraction/sync for visible message images.
- Extends `packages/core/src/domains/session-capture` service/repository behavior for image artifacts.
- Extends `packages/zero-schema/src/queries.ts` with an artifact query.
- Extends `apps/web/src/domains/captured-chats` to render artifact-backed image thumbnails/previews.
- Reuses existing file storage and authenticated file content routes where possible.
- Does not add provider sidebar crawling, hidden conversation fetching, or permanent hotlinking of provider image URLs.
