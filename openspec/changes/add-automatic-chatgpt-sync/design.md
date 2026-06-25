## Context

Manual capture proved the extension can extract visible ChatGPT messages and send them through the workspace-scoped session-capture API. Automatic sync changes the primary risk from "can we extract once?" to "can we observe a live, virtualized provider page without duplicates, credential leakage, or runaway API traffic?"

The extension should sync only sessions the user has opened in a browser tab. It should not enumerate the ChatGPT sidebar or make provider API calls.

## Goals / Non-Goals

**Goals:**
- Automatically sync configured ChatGPT tabs when opened or focused.
- Observe DOM changes and scroll-loaded history in supported ChatGPT sessions.
- Idempotently upsert messages across repeated observations, reloads, edits, and partial visible windows.
- Detect and persist coverage boundaries:
  - `oldestBoundarySeen`: the extension has evidence it reached the top/oldest loaded message boundary.
  - `latestBoundarySeen`: the extension has evidence it reached the bottom/latest conversation boundary at sync time.
- Keep sync rate bounded with debounce, batching, and per-session queues.
- Keep manual capture as a force-sync/debug action.
- Expose enough extension diagnostics that an agent can test and debug the automatic pipeline.

**Non-Goals:**
- Crawling ChatGPT history/sidebar conversations.
- Fetching provider private APIs.
- Capturing provider cookies, provider tokens, localStorage dumps, or hidden account data.
- Guaranteeing full historical completeness unless `oldestBoundarySeen` and `latestBoundarySeen` have both been observed for that source session.
- Supporting Claude/Cursor/Codex automatic sync in this change.

## Decisions

### Keep the first implementation narrow

The first implementation should prove the core loop:

1. Observe an opened ChatGPT conversation.
2. Extract the visible messages and coverage hints.
3. Send an automatic sync through the existing session-capture sync API.
4. Upsert messages idempotently.
5. Sync additional messages when scroll or DOM changes reveal them.

It should not introduce a new endpoint, a new durable queue subsystem, or new typed coverage columns unless the existing contracts/storage cannot satisfy the tests.

### Trigger automatic sync from content-script observation

The ChatGPT content script should initialize on supported conversation URLs after the extension is configured. It should extract an initial visible snapshot, then observe relevant DOM mutations and scroll/visibility events to schedule incremental syncs.

Alternative considered: background polling. Polling tabs from the service worker is less reliable in MV3 and cannot inspect provider DOM without content-script cooperation.

### Send incremental sync batches through extension-owned code

The content script should extract message/session data and send it to the background service worker. The background service worker should own capture-token access, queueing, debouncing, retries, and API calls.

This preserves the existing security boundary: provider-page code never receives the stored Contextbase capture token.

Automatic sync should use the existing session-capture sync endpoint with optional observation metadata. A separate endpoint is only justified later if the backend semantics diverge materially from manual sync.

### Treat messages as observed facts, not one complete transcript

Each automatic sync batch may contain only the messages visible or newly discovered during that observation. The backend must upsert messages by stable identity and update existing records when text/metadata changes rather than inserting duplicates.

Stable identity priority:
1. Provider message ID when available.
2. Provider turn/container ID plus role when available.
3. Deterministic fallback based on source session key, role, normalized content hash, and nearest observed order anchors.

Fallback keys are less stable for edited duplicate content, so the implementation should keep them isolated and fixture-tested.

### Persist coverage separately from message rows

Coverage is session-level metadata, not a property of an individual message. The API should accept optional coverage metadata such as:

- `observedAt`
- `visibleMessageCount`
- `oldestBoundarySeen`
- `latestBoundarySeen`
- `oldestObservedMessageKey`
- `latestObservedMessageKey`
- `observationReason`: `initial_load`, `mutation`, `scroll`, `manual_force`, or `retry`

The first implementation should store this in `captured_sessions.metadata_json` or source snapshots if possible. If querying coverage in the web app becomes necessary, add typed columns in a later change.

### Bound sync frequency

Automatic sync should use a simple per-tab debounce and latest-observation queue:

- Initial extraction after the page settles.
- Mutation/scroll observations coalesced over a short debounce window.
- No API call when the extracted message identity set is unchanged from the last accepted batch.
- Retry failed syncs with bounded backoff or on the next observation/focus/popup-open event while preserving the latest unsynced observation.

Durable retry across browser restarts is not required for the first implementation.

## Risks / Trade-offs

- ChatGPT DOM changes can break boundary detection. Boundary state must be conservative: unknown is better than falsely complete.
- Virtualized lists can remove messages from the DOM. The extension must remember observed message keys per source session during the tab lifetime.
- Fallback message keys can collide on repeated short messages. Provider IDs and DOM attributes should be preferred whenever available.
- Automatic sync can create noisy API traffic. Debounce, dedupe, and queue visibility are required before enabling it by default.
- MV3 service workers suspend. The first implementation should be recoverable by observing the tab again; durable queued delivery can follow after the core loop works.

## Open Questions

- Should automatic sync default on after pairing with a popup toggle for control?
- Should the popup show a per-tab "auto-sync active" indicator, or only last sync status?
- Which ChatGPT DOM signals are reliable enough to declare `oldestBoundarySeen` and `latestBoundarySeen`?
- Should coverage completeness be visible in the web app in this change, or only stored for later UI?
