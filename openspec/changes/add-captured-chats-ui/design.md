## Context

The session-capture backend and extension pipeline now store captured sessions, messages, source snapshots, artifacts, and sync events. The web app has the data shape needed to show a read-only captured chat experience, but the current workspace UI only links to Overview.

The UI reference is Otto's workspace chat implementation:

- `/Users/michaelfrohlich/Repositories/otto/apps/web/src/features/workspace-chat/pages/WorkspaceConversationPage.tsx`
- `/Users/michaelfrohlich/Repositories/otto/apps/web/src/features/workspace-chat/components/ConversationMessageList.tsx`
- `/Users/michaelfrohlich/Repositories/otto/apps/web/src/features/workspace-chat/components/ConversationMessageBubble.tsx`
- `/Users/michaelfrohlich/Repositories/otto/apps/web/src/features/workspace-chat/components/ConversationTurnPrimitives.tsx`
- `/Users/michaelfrohlich/Repositories/otto/apps/web/src/features/workspace-chat/sidebar/ConversationHistoryListItem.tsx`

Contextbase should borrow the interaction model and density, not Otto-specific product behavior. Captured sessions are mirrored transcripts, so the page is read-only in this change.

## Verified Current State

- `apps/web/src/app/workspace-frame/WorkspaceFrame.tsx` owns the workspace sidebar and currently exposes a single `Overview` item.
- `apps/web/src/routes/app/$workspaceSlug/index.tsx` is the current workspace overview route.
- `packages/zero-schema/src/queries.ts` already exposes workspace-scoped read queries for captured sessions, captured session messages, and sync events.
- The existing session-capture schema stores messages with workspace and captured-session identity, making workspace-scoped transcript reads possible without a new write path.
- There is no current captured chat list, detail route, sidebar history section, or transcript renderer in the web app.

## Goals / Non-Goals

**Goals:**

- Show captured chat sessions for the active workspace only.
- Provide a clear `/app/$workspaceSlug/chats` entry point and a detail route for an individual captured session.
- Keep the design very close to Otto's sidebar history and transcript display:
  - compact sidebar list items
  - centered `max-w-3xl` transcript column
  - user turns right-aligned in rounded bubbles
  - assistant turns left-aligned with mostly unframed markdown content
  - small turn headers with avatar, display name, and timestamp
- Surface sync/coverage status quietly enough to help trust the mirror without dominating the conversation reading experience.
- Keep reads on Zero and avoid adding write APIs.
- Preserve the existing workspace shell, settings shell, onboarding, auth, workspace switcher, and sidebar behavior.

**Non-Goals:**

- Sending messages back to ChatGPT/Claude or adding a Contextbase chat composer.
- Editing, deleting, reordering, or manually merging captured messages.
- Managing browser-extension pairing or capture tokens from this UI.
- Crawling provider history/sidebar sessions.
- Building a search/indexing experience across all chats.
- Adding provider-specific UI beyond labels/icons/status needed to read captured sessions.

## Design Decisions

### Place captured chats inside the workspace app shell

Captured chats are workspace data. The UI belongs under the existing `/app/$workspaceSlug` shell so auth, workspace scoping, settings, onboarding, and Zero context stay intact.

Expected route shape:

- `/app/$workspaceSlug/chats`: captured chat list/empty state.
- `/app/$workspaceSlug/chats/$capturedSessionId`: read-only transcript detail.

### Use a domain-local UI module

Implementation should live under `apps/web/src/domains/captured-chats` unless the codebase establishes a more specific local convention during implementation. Keep presentation helpers, role mapping, list item components, transcript components, and tests close together.

Suggested components:

- `CapturedChatsSidebarSection`
- `CapturedChatHistoryList`
- `CapturedChatHistoryListItem`
- `CapturedChatTranscriptPage`
- `CapturedChatMessageList`
- `CapturedChatMessageBubble`
- `CapturedChatTurnPrimitives`
- `CapturedChatStatusSummary`

### Stay close to Otto's visual structure

The implementation should copy the feel of Otto's chat UI, adapted to Contextbase tokens/components:

- Sidebar history items should use `SidebarMenuButton`, `h-8`, `gap-2`, `pr-2.5`, a small provider/status dot, truncated title, and active-route highlighting.
- Transcript should use a full-height flex column with a scroll area and a centered `max-w-3xl` message stack using `gap-5`, `px-4`, and `py-8 md:py-10`.
- User messages should render as right-aligned rounded bubbles with `max-w-[85%]`, `px-4`, `py-3`, and `rounded-[1.15rem]`.
- Assistant messages should render as left-aligned transcript content, not heavy cards.
- Turn headers should use small muted typography, a `size-7` avatar, and timestamp labels similar to Otto.
- The bottom area should not include Otto's composer. If a bottom affordance is needed, use a small sync/coverage status strip.

### Read through Zero, write nowhere

The first implementation should use existing Zero queries:

- List route/sidebar: `capturedSessionsByWorkspace`.
- Detail route: `capturedSessionMessages`.
- Status metadata: `syncEventsByCapturedSession` plus captured session metadata/source fields already replicated.

If implementation needs a detail query that joins a single captured session with messages, prefer adding a narrowly scoped Zero query with tests rather than moving reads to tRPC.

### Present capture completeness conservatively

Captured transcripts may be partial because provider UIs virtualize long sessions. The UI should display whether oldest/latest boundaries are known when metadata is available, and otherwise avoid implying that the transcript is complete.

Suggested labels:

- `Complete mirror` when both oldest and latest boundaries are observed.
- `Partial mirror` when either boundary is unknown or false.
- `Syncing` or `Last sync failed` when sync events indicate that state.

### Keep role mapping simple and explicit

Message roles should map to display turns:

- `user` -> current-user style, right aligned.
- `assistant` -> assistant style, left aligned.
- `system`, `tool`, unknown, or future roles -> muted/system style, left aligned, never hidden.

Provider display names should be derived from captured session provider metadata:

- ChatGPT -> `ChatGPT`
- Claude -> `Claude`
- Unknown provider -> `Assistant`

## Risks / Trade-offs

- Existing metadata fields may not expose coverage in the exact shape the UI wants. The UI should degrade gracefully before adding schema changes.
- Long transcripts may require pagination or virtualization later. The first version can use the existing `limit` but must not corrupt ordering or duplicate display.
- Reusing Otto's visual design too literally could import interactive assumptions. The spec explicitly excludes the composer and send/stop flows.
- Provider DOM and sync metadata will evolve. Keep presentation helpers tested and isolated from raw row details.

## Implementation Notes

- Update `apps/web/src/routes/-workspace-app-routes.test.ts` or equivalent route contract tests so captured chats routes are covered.
- Add presentation tests for title fallback, provider label, role-to-turn-kind mapping, timestamp formatting, and coverage label selection.
- Add component tests for empty history, active history item, user bubble alignment, assistant transcript rendering, and unsupported roles.
- Add a browser/UI smoke test if the repo's test setup supports it; verify the sidebar and transcript do not overlap at desktop and mobile widths.
- Do not replace `WorkspaceFrame`, `WorkspaceSwitcherMenu`, settings routes, auth routes, onboarding routes, or existing Zero provider wiring.

## Open Questions

- Should the list route auto-select the latest captured session on desktop, or remain a quiet list until the user clicks a session?
- Should the sidebar history show all providers together or group by provider once Claude support lands?
- Should transcript status be shown in the header, bottom strip, or both when sync is actively running?
