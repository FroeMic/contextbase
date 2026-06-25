## Context

Contextbase already has the generic SaaS foundation needed for captured data: authenticated users, workspaces, workspace memberships, API route patterns, Drizzle/Postgres, file storage, and a provider-neutral web shell. The next product layer is a backend domain that a browser extension can sync into without coupling the system to a single provider such as ChatGPT, Claude, Cursor, Codex, or a future coding-agent surface.

The first browser-extension PoC should prove manual sync of one visible provider session into a local workspace. Automatic/background sync is desirable later, but the backend contract should not depend on it.

## Goals / Non-Goals

**Goals:**
- Model captured sessions generically enough for AI chats, coding sessions, and agent runs.
- Ensure every captured session is owned by exactly one workspace and follows existing workspace authorization.
- Support paired capture clients that can write to one workspace without exposing broad user credentials.
- Accept idempotent manual sync batches from a browser extension.
- Store normalized sessions/messages/artifacts plus raw source snapshots for debugging and future re-parsing.
- Keep the first provider path compatible with ChatGPT on Chrome/Chromium MV3.

**Non-Goals:**
- Implement the browser extension UI, content scripts, or provider extractors in this change.
- Implement automatic/background sync.
- Crawl full provider history or hidden account data.
- Capture provider cookies, provider session tokens, or provider credentials.
- Implement Claude, Cursor, Codex, Gemini, or other provider adapters.
- Add cross-workspace sharing, moving, or copying of captured sessions.

## Decisions

### Use `captured_sessions` as the central entity

Captured AI chats and coding sessions share the same core shape: source provider, source URL, title, participants, ordered messages/events, artifacts, snapshots, and sync history. A single `captured_sessions` domain with a `kind` value such as `chat`, `coding`, or `agent_run` avoids overfitting the first implementation to chat-only data.

Alternative considered: separate chat-session and coding-session domains. That would make the first ChatGPT PoC slightly simpler, but it would duplicate ownership, sync, and idempotency logic before the differences are proven.

### Make workspace ownership immutable for the PoC

Each captured session belongs to exactly one workspace. Moving or copying sessions between workspaces is out of scope until there is a real product need and an audit/security model for that behavior.

Alternative considered: allow sessions to move between workspaces. That adds authorization, provenance, and deduplication complexity before the capture flow exists.

### Pair capture clients to a workspace-scoped token

The extension should pair with Contextbase through a local pairing flow that creates a capture-client token scoped to a single workspace and limited to capture ingestion. The extension should not reuse provider credentials and should not need a broad user API token.

Alternative considered: use the browser login session directly. That is convenient locally, but it makes extension/background behavior and future automatic sync harder to reason about.

### Accept idempotent sync batches

The ingestion API should accept a complete or partial view of the current provider session and upsert by stable provider IDs when available, falling back to deterministic fingerprints when provider IDs are missing. Re-running manual sync for the same browser page must update the captured session without duplicating messages.

Alternative considered: append-only ingestion. Append-only events preserve history, but without idempotent normalization the PoC would quickly create duplicate messages whenever a user clicks sync repeatedly.

### Store raw source snapshots with normalized data

Each sync batch should store a raw source snapshot, such as extracted JSON/DOM-derived source data, alongside normalized records. Provider pages change often, and snapshots let us debug extractors or re-parse old captures later.

Alternative considered: store normalized records only. That keeps storage smaller, but it removes the evidence needed to improve parsers when provider markup changes.

### Keep automatic sync out of this change but compatible with the model

The first behavior is manual "sync this session." The model still records capture clients, sync batches, and sync events so a later automatic/background sync change can reuse the same backend contract.

Alternative considered: design automatic sync immediately. That would force background scheduling, rate limits, browser lifecycle, and consent questions before the user value of session mirroring is proven.

## Risks / Trade-offs

- Provider DOMs and client data structures change often -> Store raw snapshots and keep provider extraction outside the backend domain.
- Providers may omit stable message IDs -> Support deterministic fingerprints and document possible collision/update behavior.
- Raw snapshots can contain sensitive content -> Scope snapshots to a workspace, apply existing authorization, and avoid storing provider credentials or cookies.
- Capture-client tokens could become powerful write credentials -> Scope them to one workspace and capture-ingestion permissions only.
- A generic model can become too abstract -> Keep the first schema focused on sessions, messages, artifacts, snapshots, clients, and sync events.

## Migration Plan

Add new tables through the normal Drizzle migration flow. The change is additive and should not require modifying existing workspace/auth/storage records. Rollback can drop the new session-capture tables before real captured data exists.

## Open Questions

- Which fields should be required for the first ChatGPT extractor versus optional for future providers?
- Should raw snapshots be stored directly in Postgres JSONB for the PoC, or through the existing file storage abstraction when they become large?
- What is the exact pairing UX in the later browser-extension change: one-time code, local callback, or web-issued token download?
