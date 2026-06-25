## 1. Extension App Scaffold

- [x] 1.1 Create `apps/browser-extension` as a pnpm workspace app with TypeScript, build, test, typecheck, and lint-compatible source layout.
- [x] 1.2 Add a Chromium Manifest V3 manifest with popup, background service worker, ChatGPT content script matches, and minimal permissions.
- [x] 1.3 Add build tooling that emits a loadable unpacked extension directory at `apps/browser-extension/dist`.
- [x] 1.4 Add README or docs for loading the unpacked extension locally and connecting it to the local Contextbase API.

## 2. Configuration And Pairing

- [x] 2.1 Add extension storage helpers for API base URL, capture token, client metadata, and last sync status.
- [x] 2.2 Add popup setup UI for pairing with API base URL plus temporary API token.
- [x] 2.3 Add popup setup UI for pasting an existing capture token.
- [x] 2.4 Ensure broad API tokens are not persisted after successful capture-client pairing.
- [x] 2.5 Add tests for storage serialization, clear-config behavior, and pairing request payloads.

## 3. Provider Detection And ChatGPT Extraction

- [x] 3.1 Define an internal provider adapter interface for provider detection, extraction, parser version, and payload mapping.
- [x] 3.2 Implement ChatGPT URL detection for `chatgpt.com` and legacy `chat.openai.com` origins.
- [x] 3.3 Implement ChatGPT visible-conversation extraction for title, source URL, ordered messages, roles, text content, source IDs when available, and source snapshot.
- [x] 3.4 Add ChatGPT fixture tests covering normal conversations, missing titles, missing provider message IDs, edited/repeated extraction, and unsupported pages.
- [x] 3.5 Assert extraction does not collect provider cookies, tokens, localStorage dumps, or hidden account data.

## 4. Extension Messaging And Manual Sync

- [x] 4.1 Add popup-to-content-script messaging for "extract current session" on the active tab.
- [x] 4.2 Add background/service-worker sync logic that posts `SessionCaptureManualSyncBody` to `/api/v1/session-capture/sync/manual` with the stored capture token.
- [x] 4.3 Map extracted ChatGPT data into the shared session-capture contract types from `@contextbase/contracts`.
- [x] 4.4 Show popup states for unsupported tab, missing configuration, extracting, syncing, success, and failure.
- [x] 4.5 Add tests for message passing, sync success, API rejection, and network failure behavior.

## 5. Local Verification

- [x] 5.1 Run `pnpm --filter @contextbase/browser-extension build` and verify `dist/manifest.json` exists.
- [x] 5.2 Run browser-extension unit tests.
- [x] 5.3 Run repo-level `pnpm lint`.
- [x] 5.4 Run repo-level `pnpm typecheck`.
- [x] 5.5 Run repo-level `pnpm test`.
- [x] 5.6 Validate the OpenSpec change with `openspec validate add-browser-extension-poc`.
