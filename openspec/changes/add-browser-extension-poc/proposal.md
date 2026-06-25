## Why

Contextbase now has the backend session-capture domain, but there is no installable capture client that proves a real browser session can be mirrored into a workspace. A browser-extension PoC is the next necessary step because the hardest unknown is extracting useful session data from live ChatGPT/Claude-style web apps without coupling the backend to provider DOM details.

## What Changes

- Add a first-class browser-extension workspace app under `apps/browser-extension`.
- Build a Chromium Manifest V3 extension that can be loaded locally as an unpacked extension.
- Add a popup setup flow for local Contextbase API configuration and capture-client pairing.
- Store only the Contextbase API base URL and workspace-scoped capture token in extension storage after pairing.
- Add a ChatGPT content-script extractor for the currently visible conversation on `chatgpt.com` and legacy `chat.openai.com` URLs.
- Add a manual "capture current session" flow that sends normalized session/message data plus a raw source snapshot to `POST /api/v1/session-capture/sync/manual`.
- Add extension-side status/error reporting so the user can see whether the last capture succeeded.
- Add tests for provider detection, ChatGPT extraction fixtures, payload mapping, storage behavior, and message-passing behavior.
- Explicitly exclude automatic/background sync, full chat-history crawling, Claude/Cursor/Codex adapters, marketplace packaging, and provider credential capture from this PoC.

## Capabilities

### New Capabilities

- `browser-extension-capture`: Defines local extension installation, pairing/configuration, ChatGPT visible-session extraction, manual sync, and extension-side verification behavior.

### Modified Capabilities

- None.

## Impact

- Adds a new pnpm workspace app at `apps/browser-extension`.
- Adds browser-extension build/test/typecheck scripts and root script integration where useful.
- Reuses `@contextbase/contracts` and `@contextbase/api-client` for API payload types and calls.
- Does not add new backend tables or API endpoints unless implementation discovers a small pairing/status gap that must be specified before coding.
- Produces a local unpacked extension build artifact that can be installed from `apps/browser-extension/dist`.
