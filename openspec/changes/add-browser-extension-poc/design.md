## Context

The session-capture backend is implemented: Contextbase can create workspace-scoped capture clients and ingest idempotent manual sync batches through the API service. The missing product proof is an extension that can run inside a real provider tab, extract the visible conversation, and sync it into the paired workspace.

The repo is a pnpm monorepo with first-class runnable apps under `apps/*` and shared libraries under `packages/*`. A browser extension is a deployable application, not a shared library, so it should live under `apps/browser-extension`.

## Goals / Non-Goals

**Goals:**
- Create a locally loadable Chromium Manifest V3 extension.
- Keep the extension provider-neutral in structure while implementing ChatGPT first.
- Pair the extension with one Contextbase workspace through the existing capture-client API.
- Avoid persisting broad user/API credentials after pairing.
- Extract the currently visible ChatGPT conversation title, source URL, stable provider IDs when available, roles, ordered message content, and a raw source snapshot.
- Submit manual sync payloads through the existing session-capture API.
- Provide enough popup status and errors to debug the PoC without opening devtools.
- Add tests that let an implementation agent detect parser regressions as ChatGPT markup assumptions change.

**Non-Goals:**
- Automatic/background sync.
- Crawling provider chat history or opening hidden conversations.
- Capturing provider cookies, provider tokens, or provider credentials.
- Supporting Claude, Cursor, Codex, Gemini, or other providers in the first implementation.
- Marketplace packaging, signing, publishing, or cross-browser support beyond Chromium MV3.
- Building the web app UI for browsing captured sessions.

## Decisions

### Put the extension in `apps/browser-extension`

The extension has its own manifest, popup, service worker, content scripts, build output, and manual install flow. It should be versioned and tested as a runnable app next to `apps/web`, `apps/api`, and `apps/cli`, while reusing shared packages for contracts/API calls.

Alternative considered: `packages/browser-extension`. That would make it look like a library and blur the build artifact boundary. The extension is not imported by other packages; it is installed into the browser.

### Keep the first popup simple and local-development focused

The popup should support two setup paths:
- Pair with API base URL + temporary Contextbase API token, then store only the returned capture token.
- Paste an existing capture token for local debugging.

After setup, the popup should show the configured API base URL, connection state, provider/tab detection, a "capture current session" action, and last sync result.

Alternative considered: Build a full web-based OAuth/pairing callback immediately. That is a better long-term UX, but it introduces browser redirect and auth-state complexity before the extractor has been proven.

### Use manual capture as the only sync trigger

The PoC should run extraction only when the user clicks the popup action. This keeps consent explicit, avoids browser lifecycle complexity, and makes parser debugging easier.

Alternative considered: Auto-sync with a background alarm or content-script observer. That is likely needed later, but it adds duplicate suppression, rate limiting, notification, and lifecycle questions too early.

### Implement provider adapters behind a small internal interface

The first adapter is ChatGPT, but the extension should route through a provider adapter interface such as:

- `detectProvider(location): ProviderMatch | null`
- `extractSession(document, location): ExtractedSession`
- `toManualSyncPayload(extracted): SessionCaptureManualSyncBody`

This keeps future Claude/Cursor/Codex adapters from rewriting popup/background messaging.

Alternative considered: Hard-code ChatGPT extraction directly in the popup. That is faster for a throwaway demo, but it would make the next provider unnecessarily messy.

### Use content-script extraction plus service-worker API calls

The popup should ask the active tab content script to extract the visible session. The extension background/service worker should own sync calls and storage access, so the content script does not need the capture token.

Alternative considered: Let the content script call the API directly. That exposes the capture token in the provider page execution context boundary and makes host permissions harder to reason about.

### Store raw snapshots, not provider credentials

The raw snapshot should be the extension's extracted structured view and limited DOM/debug metadata needed to improve parsers. It must not include cookies, localStorage dumps, provider auth headers, or hidden account data.

Alternative considered: Store full HTML. Full HTML is easy to capture, but it is noisy, larger, more sensitive, and more likely to include unrelated page data.

## Risks / Trade-offs

- ChatGPT DOM structure changes often -> Keep extractor logic isolated, fixture-tested, and tolerant of missing optional fields.
- Provider stable IDs may be missing -> Fall back to deterministic keys based on role/order/content, matching backend idempotency behavior.
- Extension permissions can become too broad -> Restrict host permissions to Contextbase API origins and ChatGPT origins for the PoC.
- Capture token leakage would permit workspace-scoped writes -> Store only the capture token, never broad API tokens; keep content scripts away from token storage.
- Manual-only capture may feel limited -> This is intentional for PoC; automatic sync should be a later OpenSpec change after manual extraction works.

## Migration Plan

This change is additive. Add `apps/browser-extension` to the existing pnpm workspace by virtue of the current `apps/*` workspace pattern. No database migration is expected. The local install path is to build the extension and load `apps/browser-extension/dist` as an unpacked extension in Chromium.

Rollback is removing the new app and any root scripts added for convenience; backend session-capture functionality remains intact.

## Open Questions

- Should the first setup screen default to `http://127.0.0.1:3017` or detect local-domain API URLs such as `https://api.contextbase-2.test`?
- Should the extension include a one-click "pair using API token" flow in the first implementation, or should the first implementation require a pre-created capture token only?
- Which ChatGPT DOM attributes are stable enough for source message IDs, and what fixture set best represents current ChatGPT markup?
