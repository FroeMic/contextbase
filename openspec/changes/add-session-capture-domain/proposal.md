## Why

Contextbase needs a provider-neutral backend foundation before a browser extension can mirror ChatGPT, Claude, coding-agent, or future AI sessions into a local workspace. Defining the capture domain first keeps session ownership, workspace visibility, idempotent sync, and security boundaries explicit before extractor code is introduced.

## What Changes

- Add a workspace-scoped captured-session domain for AI chats, coding sessions, and agent runs.
- Add provider and capture-client concepts so browser extensions and future importers can sync into a specific workspace.
- Add normalized storage for sessions, messages, artifacts, sync batches, sync events, and raw source snapshots.
- Add ingestion API requirements for manual PoC sync from a paired browser extension.
- Require sync writes to be idempotent so repeated extraction of the same browser session updates state without duplicating messages.
- Explicitly exclude automatic/background sync, full provider history crawling, provider credential capture, and multi-provider extractor implementation from this change.
- Preserve the existing workspace boundary: captured sessions are visible only to authorized members of the workspace they belong to.

## Capabilities

### New Capabilities
- `session-capture`: Defines provider-neutral captured sessions, messages, artifacts, source snapshots, capture clients, ingestion API behavior, and sync events.

### Modified Capabilities
- `workspaces`: Captured sessions become workspace-owned data and must follow existing workspace membership and authorization rules.

## Impact

- Adds new core domain code, database schema, repositories, services, contracts, API routes, API-client helpers, and tests for session capture.
- Extends active Drizzle and Zero schemas with workspace-scoped session capture tables.
- Adds or updates OpenSpec requirements for workspace ownership of captured sessions.
- Does not add the browser extension implementation yet; this change creates the backend contract the extension will use.
