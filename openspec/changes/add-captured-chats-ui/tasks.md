## 1. Data And Routing Contracts

- [ ] 1.1 Confirm existing Zero queries provide the required session list, message list, and sync-event data for the UI.
- [ ] 1.2 Add or adjust narrowly scoped Zero queries only if required for a single-session detail read or stable ordering.
- [ ] 1.3 Add `/app/$workspaceSlug/chats` and `/app/$workspaceSlug/chats/$capturedSessionId` route files.
- [ ] 1.4 Extend route contract tests so captured chat routes are part of the workspace route surface.

## 2. Captured Chats Presentation Model

- [ ] 2.1 Add presentation helpers for captured-session title fallback, provider labels, timestamps, role mapping, and coverage/sync status.
- [ ] 2.2 Add unit tests for presentation helpers, including unknown providers and unsupported message roles.
- [ ] 2.3 Ensure duplicate messages are not rendered if the UI receives repeated rows or equivalent source identities.
- [ ] 2.4 Ensure messages render in ascending conversation order.

## 3. Sidebar History

- [ ] 3.1 Add a `Chats` navigation item to the workspace sidebar.
- [ ] 3.2 Add a captured chat history section modeled after Otto's compact conversation history.
- [ ] 3.3 Use active-route highlighting for the selected captured session.
- [ ] 3.4 Show empty and loading states without disrupting the existing workspace switcher/settings/logout behavior.

## 4. Transcript UI

- [ ] 4.1 Build the captured chat list route with a quiet empty state and recent-session list.
- [ ] 4.2 Build the captured chat detail route as a read-only transcript.
- [ ] 4.3 Match Otto's core transcript layout: full-height scroll area, centered `max-w-3xl` column, `gap-5`, and compact turn headers.
- [ ] 4.4 Match Otto's turn styling: user bubbles right-aligned and rounded; assistant turns left-aligned and mostly unframed.
- [ ] 4.5 Show provider, latest sync, and mirror-completeness status quietly in the detail UI.
- [ ] 4.6 Do not add a composer, send button, stop button, or provider write action.

## 5. Verification

- [ ] 5.1 Add component tests for history item active state, empty history, transcript empty state, user bubble alignment, assistant rendering, and unsupported roles.
- [ ] 5.2 Add workspace-scoping tests proving captured chats only read the active workspace data through Zero query context.
- [ ] 5.3 Add a browser/UI smoke test or Storybook-style visual test if supported by the repo.
- [ ] 5.4 Run OpenSpec validation, lint, typecheck, and the relevant web/unit test suite.
