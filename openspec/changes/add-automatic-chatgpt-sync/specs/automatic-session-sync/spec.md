## ADDED Requirements

### Requirement: Automatic Open-Tab Sync
Contextbase SHALL automatically sync supported ChatGPT sessions from configured browser-extension tabs without requiring the user to click manual capture for each update.

#### Scenario: Initial supported session load
- **WHEN** a configured extension observes an open ChatGPT conversation tab
- **THEN** it extracts the currently available session data after the page settles
- **AND** sends an automatic sync batch through extension-owned code using the stored capture token
- **AND** does not expose the stored capture token to the provider page content script

#### Scenario: Unsupported or unconfigured tab
- **WHEN** the extension is not configured or the active tab is not a supported ChatGPT conversation
- **THEN** automatic sync does not send session data
- **AND** the popup can report why automatic sync is inactive

#### Scenario: No hidden history crawling
- **WHEN** automatic sync is enabled
- **THEN** the extension only syncs sessions opened by the user in browser tabs
- **AND** it does not crawl the ChatGPT sidebar, open hidden conversations, call provider private APIs, or collect provider credentials

### Requirement: Scroll-Discovered Message Sync
Contextbase SHALL sync additional ChatGPT messages when they become visible or available after the initial observation.

#### Scenario: Older messages appear after scrolling upward
- **WHEN** the user scrolls a ChatGPT conversation and older messages are inserted into or become available in the DOM
- **THEN** the extension schedules an incremental sync for those messages
- **AND** previously synced messages are not duplicated

#### Scenario: New messages appear during an active conversation
- **WHEN** the user or assistant adds new messages to an already observed ChatGPT session
- **THEN** the extension schedules an incremental sync for the new or changed messages
- **AND** the backend workspace copy reflects the latest observed message content

#### Scenario: Virtualized DOM removes messages
- **WHEN** ChatGPT removes previously observed messages from the DOM due to virtualization
- **THEN** the extension does not treat absence from the DOM as deletion
- **AND** it keeps enough tab/session state to avoid resending unchanged observations unnecessarily

### Requirement: Idempotent Message Upserts
Contextbase SHALL treat every automatic sync batch as an idempotent observation of session messages.

#### Scenario: Same message observed repeatedly
- **WHEN** the same source message is observed in multiple automatic sync batches
- **THEN** Contextbase stores one message row for that source message within the captured session
- **AND** repeated observations update mutable fields rather than inserting duplicates

#### Scenario: Provider message ID unavailable
- **WHEN** ChatGPT markup does not expose a provider message ID for a message
- **THEN** the extension and backend use a deterministic fallback identity
- **AND** the fallback identity is stable across repeated observations of the same visible message

#### Scenario: Edited or regenerated message
- **WHEN** a previously observed message appears with changed content or metadata under the same stable source identity
- **THEN** Contextbase updates the stored message content/metadata
- **AND** the sync event records that an existing message was updated

### Requirement: Coverage Boundary Tracking
Contextbase SHALL track whether an automatically synced ChatGPT session is known complete at the oldest and latest visible boundaries.

#### Scenario: Oldest boundary unknown
- **WHEN** the extension has not observed evidence that it reached the top/oldest boundary of a ChatGPT session
- **THEN** the captured session coverage records `oldestBoundarySeen` as false or unknown
- **AND** the session is not presented as historically complete

#### Scenario: Oldest boundary reached
- **WHEN** the extension observes reliable evidence that the top/oldest boundary of the ChatGPT session has been reached
- **THEN** the captured session coverage records `oldestBoundarySeen`
- **AND** records the oldest observed message key when available

#### Scenario: Latest boundary reached
- **WHEN** the extension observes reliable evidence that the bottom/latest boundary of the ChatGPT session has been reached at sync time
- **THEN** the captured session coverage records `latestBoundarySeen`
- **AND** records the latest observed message key when available

#### Scenario: Boundary detection is conservative
- **WHEN** ChatGPT markup or virtualization makes a boundary ambiguous
- **THEN** the extension records the boundary as unknown rather than complete
- **AND** automatic sync continues to upsert messages that are observed later

### Requirement: Automatic Sync Rate Control And Diagnostics
Contextbase SHALL keep automatic sync bounded, observable, and recoverable.

#### Scenario: Repeated DOM mutations
- **WHEN** a ChatGPT page emits repeated DOM mutations or scroll events
- **THEN** the extension debounces observations into bounded sync batches
- **AND** skips API calls when the observed message identity/content fingerprint has not changed

#### Scenario: API failure
- **WHEN** an automatic sync request fails
- **THEN** the extension records the failure for diagnostics
- **AND** retries with bounded backoff without discarding newer observations

#### Scenario: User-visible status
- **WHEN** the popup opens for a configured extension
- **THEN** it shows whether automatic sync is active for the current tab
- **AND** shows the last automatic sync status or failure reason

### Requirement: Automatic Sync End-To-End Verification
Contextbase SHALL include automated verification for the automatic ChatGPT sync lifecycle.

#### Scenario: Automatic sync E2E
- **WHEN** the E2E test loads the built extension and opens a fixture ChatGPT conversation
- **THEN** the session syncs without clicking manual capture
- **AND** the local Contextbase-compatible API receives the expected automatic sync payload

#### Scenario: Scroll history E2E
- **WHEN** the E2E test scrolls the fixture conversation to reveal older messages
- **THEN** those older messages are synced
- **AND** repeated observations do not create duplicate messages

#### Scenario: Coverage E2E
- **WHEN** the fixture page exposes reliable top and bottom boundary states
- **THEN** the E2E test verifies the stored coverage metadata reflects the observed boundaries
