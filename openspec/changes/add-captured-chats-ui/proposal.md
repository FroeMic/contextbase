## Why

Contextbase can now capture and automatically sync ChatGPT sessions into workspace-scoped database tables, but the web app still only exposes the workspace overview placeholder. Users need a first-class way to browse captured sessions, open a transcript, and inspect whether the mirrored copy is current or only partially observed.

The target UI should stay very close to Otto's workspace chat experience because that design already solved the important ergonomics: a compact workspace sidebar history, a calm centered transcript, lightweight message headers, and visually distinct user/assistant turns.

## What Changes

- Add a captured chats section inside the existing workspace app shell.
- Add workspace routes for captured chat list/detail views.
- Use existing Zero read queries for sessions, messages, and sync events.
- Render a compact captured chat history in the workspace sidebar, modeled after Otto's conversation history.
- Render a read-only transcript view modeled after Otto's conversation page and message bubbles.
- Show provider, sync, and coverage status without turning the page into an operations dashboard.
- Add tests for route wiring, workspace scoping, presentation mapping, message rendering, empty states, and responsive layout.

## Capabilities

### New Capabilities

- `captured-chats-ui`: Defines the web UI for listing and reading captured chat sessions within a workspace.

### Modified Capabilities

- `web-shell`: The workspace shell navigation gains a captured chats entry and captured chat history section while preserving existing workspace, settings, auth, and onboarding behavior.
- `web-data-access`: Captured chat UI reads from Zero and does not introduce tRPC writes.

## Impact

- Adds web UI code under `apps/web/src/domains/captured-chats` or an equivalent domain-local folder.
- Adds TanStack Router routes under `apps/web/src/routes/app/$workspaceSlug/chats`.
- Updates `apps/web/src/app/workspace-frame/WorkspaceFrame.tsx` to include captured chat navigation/history.
- Reuses `packages/zero-schema/src/queries.ts` queries where possible:
  - `capturedSessionsByWorkspace`
  - `capturedSessionMessages`
  - `syncEventsByCapturedSession`
- Does not add new database tables for the first implementation.
- Does not add a chat composer, assistant reply flow, provider crawling, or capture-token management UI.
