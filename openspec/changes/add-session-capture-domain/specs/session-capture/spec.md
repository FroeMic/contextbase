## ADDED Requirements

### Requirement: Provider-Neutral Captured Sessions
Contextbase SHALL store captured AI and coding sessions using a provider-neutral model that supports chats, coding sessions, and agent runs.

#### Scenario: Create captured session
- **WHEN** a valid ingestion request creates or updates a provider session
- **THEN** Contextbase stores a captured session with workspace ownership, provider identity, session kind, source URL, source identifier when available, title, and capture timestamps
- **AND** the captured session is not modeled as provider-specific product data

#### Scenario: Session kind supports future coding sessions
- **WHEN** a captured session is stored
- **THEN** its kind distinguishes chat, coding, agent-run, or unknown session types without requiring separate ownership models

### Requirement: Workspace-Scoped Capture Clients
Contextbase SHALL support capture clients that are paired to exactly one workspace and limited to session-capture ingestion.

#### Scenario: Capture client writes to paired workspace
- **WHEN** a paired capture client submits a sync batch
- **THEN** Contextbase accepts writes only for the workspace assigned to that capture client
- **AND** the client cannot write captured sessions into another workspace

#### Scenario: Capture client avoids provider credentials
- **WHEN** a browser extension pairs with Contextbase
- **THEN** Contextbase issues or validates only Contextbase capture credentials
- **AND** provider cookies, provider session tokens, and provider account credentials are not accepted as capture-client credentials

### Requirement: Manual Sync Ingestion API
Contextbase SHALL provide an ingestion API for manually syncing the currently visible browser session into the paired workspace.

#### Scenario: Manual sync batch accepted
- **WHEN** a paired capture client submits normalized session data, messages, artifacts, and source snapshot metadata
- **THEN** Contextbase validates the workspace scope and persists the sync batch
- **AND** the API returns the captured session identifier and sync result summary

#### Scenario: Automatic sync not required
- **WHEN** the session-capture domain is implemented
- **THEN** users can sync by explicit manual action
- **AND** automatic/background sync is not required until a later OpenSpec change

### Requirement: Idempotent Sync Batches
Contextbase SHALL make repeated sync of the same provider session idempotent.

#### Scenario: Repeated manual sync does not duplicate messages
- **WHEN** a capture client submits the same provider session and messages more than once
- **THEN** Contextbase updates existing captured records using stable provider identifiers or deterministic fingerprints
- **AND** duplicate session messages are not created

#### Scenario: New provider messages are appended in order
- **WHEN** a later sync batch includes additional messages for an existing captured session
- **THEN** Contextbase stores the new messages and preserves provider/source ordering where available

### Requirement: Captured Messages And Artifacts
Contextbase SHALL store normalized captured messages and artifacts under their captured session.

#### Scenario: Store captured messages
- **WHEN** a sync batch includes user, assistant, system, tool, or unknown messages
- **THEN** Contextbase stores each message with role, content, ordering, provider identifiers when available, and source metadata

#### Scenario: Store captured artifacts
- **WHEN** a sync batch includes code blocks, generated files, attachments, images, links, or other artifacts
- **THEN** Contextbase stores artifact metadata under the captured session or message
- **AND** larger binary content can be referenced through the existing storage system instead of embedded in the session record

### Requirement: Raw Source Snapshots
Contextbase SHALL preserve raw source snapshots for sync batches so extractor behavior can be audited and improved.

#### Scenario: Store source snapshot
- **WHEN** a capture client submits a sync batch
- **THEN** Contextbase stores a raw source snapshot or durable reference to that snapshot with provider, source URL, capture time, and parser version metadata

#### Scenario: Snapshot follows workspace authorization
- **WHEN** a user requests a source snapshot
- **THEN** Contextbase authorizes access through the captured session's workspace membership

### Requirement: Sync Events
Contextbase SHALL record sync events for capture attempts and outcomes.

#### Scenario: Successful sync event
- **WHEN** a sync batch is persisted
- **THEN** Contextbase records a sync event with capture client, provider, workspace, captured session, status, counts, and timestamp

#### Scenario: Failed sync event
- **WHEN** a sync batch is rejected or fails validation
- **THEN** Contextbase records or returns enough structured error information for the extension to report the failure without exposing provider credentials
