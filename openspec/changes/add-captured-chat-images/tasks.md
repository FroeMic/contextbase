## 1. Contracts And Storage

- [x] 1.1 Add `capturedMessageSourceKey` to session-capture artifact input contracts.
- [x] 1.2 Add a capture-token protected image upload endpoint that stores workspace-scoped file objects.
- [x] 1.3 Reject unsupported content types, oversize images, and invalid capture tokens with tested errors.
- [x] 1.4 Resolve artifact `capturedMessageSourceKey` to `capturedMessageId` during sync after message upserts.
- [x] 1.5 Preserve artifact idempotency by `capturedSessionId + sourceArtifactKey`.

## 2. Zero Query Surface

- [x] 2.1 Add `capturedSessionArtifacts` to `packages/zero-schema/src/queries.ts`.
- [x] 2.2 Add query tests proving active-workspace filtering and captured-session filtering.
- [x] 2.3 Ensure generated Zero schema/table replication includes artifact rows needed by the web UI.

## 3. Browser Extension Capture

- [x] 3.1 Extend ChatGPT extraction fixtures to include visible message images.
- [x] 3.2 Generate stable source artifact keys for visible images.
- [x] 3.3 Upload image bytes with the capture token before or during sync.
- [x] 3.4 Include uploaded image artifacts in automatic and manual sync payloads.
- [x] 3.5 Do not expose capture tokens to content scripts or provider page JavaScript.
- [x] 3.6 Record clear diagnostics for CORS, decode, upload, and size-limit failures.

## 4. Captured Chats UI

- [x] 4.1 Read image artifacts for the open captured session through Zero.
- [x] 4.2 Group artifacts by `capturedMessageId` and render them under the associated message.
- [x] 4.3 Render image thumbnails from Contextbase file routes, not provider URLs.
- [x] 4.4 Open image previews using existing markdown/file preview behavior where possible.
- [x] 4.5 Render unavailable image artifacts as compact file cards instead of broken images.
- [x] 4.6 Keep image layout inside the existing Otto-style transcript column on desktop and mobile.

## 5. Verification

- [x] 5.1 Add contract/API tests for capture-token image upload and artifact source-key association.
- [x] 5.2 Add extension unit and fixture tests for image extraction, repeated observations, and failure diagnostics.
- [x] 5.3 Add web presentation/component tests for message-level image rendering, session-level image rendering, unavailable artifacts, and no-provider-hotlink behavior.
- [x] 5.4 Add an extension E2E fixture that syncs a ChatGPT transcript containing an image and verifies the web transcript can render it.
- [x] 5.5 Run OpenSpec validation, lint, typecheck, unit tests, extension E2E, and a browser smoke test.
