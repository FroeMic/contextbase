## ADDED Requirements

### Requirement: Captured Chats Workspace Navigation
Contextbase SHALL expose captured chats as a first-class read-only workspace section inside the existing authenticated workspace shell.

#### Scenario: Workspace navigation includes captured chats
- **WHEN** an authenticated user opens `/app/$workspaceSlug`
- **THEN** the workspace sidebar includes a `Chats` navigation item
- **AND** the item links to `/app/$workspaceSlug/chats`
- **AND** existing Overview, workspace switcher, settings, logout, auth, onboarding, and Zero provider behavior remains available

#### Scenario: Captured chat history appears in the sidebar
- **WHEN** the active workspace has captured sessions
- **THEN** the workspace sidebar shows a compact captured chat history section modeled after Otto's conversation history
- **AND** each item shows a provider/status indicator, truncated title, and active-route state
- **AND** selecting an item opens `/app/$workspaceSlug/chats/$capturedSessionId`

#### Scenario: Empty workspace history
- **WHEN** the active workspace has no captured sessions
- **THEN** the sidebar and chats route show quiet empty states
- **AND** they do not show onboarding, marketing, or setup copy unrelated to reading captured chats

### Requirement: Workspace-Scoped Zero Reads
Contextbase SHALL read captured chat UI data through workspace-scoped Zero queries.

#### Scenario: Session list read
- **WHEN** the captured chats list or sidebar history renders
- **THEN** it reads sessions with the active workspace context
- **AND** it excludes sessions from other workspaces
- **AND** it orders sessions by latest sync/activity with newest first

#### Scenario: Transcript read
- **WHEN** a captured session detail route renders
- **THEN** it reads messages for the requested captured session and active workspace
- **AND** it orders messages by ascending conversation order
- **AND** it does not display messages from another workspace even if a foreign captured session id is supplied

#### Scenario: Status read
- **WHEN** sync or coverage status is displayed
- **THEN** it uses replicated captured-session metadata and/or sync events from Zero
- **AND** it does not introduce tRPC writes or new mutation endpoints for this read-only UI

### Requirement: Otto-Style Captured Transcript
Contextbase SHALL render captured session messages with an Otto-style read-only transcript layout adapted to Contextbase.

#### Scenario: Transcript layout
- **WHEN** a captured session is opened
- **THEN** the transcript uses a full-height scrollable content area
- **AND** messages render in a centered `max-w-3xl` column with compact vertical spacing
- **AND** the UI does not include a composer, send button, stop button, or provider write action

#### Scenario: User message rendering
- **WHEN** a captured message has role `user`
- **THEN** it renders right-aligned
- **AND** it uses a rounded message bubble similar to Otto's user turn styling
- **AND** long text wraps without overflowing the transcript column

#### Scenario: Assistant message rendering
- **WHEN** a captured message has role `assistant`
- **THEN** it renders left-aligned
- **AND** it uses mostly unframed markdown/text presentation similar to Otto's assistant turns
- **AND** code blocks, lists, and plain paragraphs remain readable

#### Scenario: Other role rendering
- **WHEN** a captured message has role `system`, `tool`, unknown, or a future provider role
- **THEN** it renders in a muted/system style
- **AND** it is not hidden from the transcript

#### Scenario: Turn headers
- **WHEN** a message starts a visible turn
- **THEN** the UI shows a compact header with avatar, display name, and timestamp
- **AND** repeated adjacent messages from the same role may be visually grouped only when grouping does not change message order or hide content

### Requirement: Captured Session Status
Contextbase SHALL make mirror freshness and completeness understandable without overwhelming the transcript.

#### Scenario: Provider and source identity
- **WHEN** a captured session is displayed
- **THEN** the UI shows the provider label such as `ChatGPT`, `Claude`, or a safe fallback
- **AND** it shows the captured session title or a deterministic fallback title

#### Scenario: Complete mirror status
- **WHEN** session metadata indicates both oldest and latest boundaries have been observed
- **THEN** the UI may label the transcript as a complete mirror
- **AND** the label is visually secondary to the transcript content

#### Scenario: Partial mirror status
- **WHEN** either boundary is unknown, false, or missing
- **THEN** the UI labels the transcript as partial or otherwise avoids implying historical completeness
- **AND** the transcript still shows all observed messages

#### Scenario: Sync failure status
- **WHEN** the latest sync event indicates failure
- **THEN** the UI shows a concise failure status
- **AND** it does not block reading already captured messages

### Requirement: Captured Chats UI Verification
Contextbase SHALL include automated checks that keep the captured chats UI scoped, readable, and close to the intended Otto-inspired design.

#### Scenario: Route contract verification
- **WHEN** the route tests run
- **THEN** they verify the captured chats list and detail routes exist under the workspace app route tree
- **AND** they verify those routes do not bypass the workspace frame

#### Scenario: Presentation verification
- **WHEN** presentation tests run
- **THEN** they cover provider label fallback, title fallback, role mapping, timestamp formatting, coverage labels, and message ordering

#### Scenario: Component verification
- **WHEN** component tests run
- **THEN** they cover empty history, active history item, transcript empty state, user bubble alignment, assistant rendering, unsupported roles, and long text wrapping

#### Scenario: Responsive verification
- **WHEN** browser or visual smoke tests run
- **THEN** they verify the sidebar and transcript do not overlap on desktop and mobile widths
- **AND** message text remains contained inside its parent element
