## ADDED Requirements

### Requirement: Captured Chat Image Storage
Contextbase SHALL store captured chat images as workspace-scoped Contextbase files before rendering them in transcripts.

#### Scenario: Visible provider image captured
- **WHEN** a configured browser extension observes an image inside a supported opened chat session
- **THEN** it captures the visible image as an image artifact with a stable `sourceArtifactKey`
- **AND** uploads the image bytes to Contextbase using extension-owned code and the stored capture token
- **AND** syncs an artifact row referencing the returned `fileObjectId`

#### Scenario: Provider URL is private or temporary
- **WHEN** the provider image source is a blob URL, data URL, expiring URL, or private provider URL
- **THEN** Contextbase stores and renders a Contextbase-owned file copy
- **AND** the persisted transcript does not rely on the provider URL for durable display

#### Scenario: Image cannot be copied
- **WHEN** an image cannot be fetched, decoded, uploaded, or is rejected by size/type validation
- **THEN** text message sync continues
- **AND** the extension records a diagnostic for the image failure
- **AND** the UI does not render a broken image

### Requirement: Image Artifact Message Association
Contextbase SHALL associate captured image artifacts with the correct captured message idempotently.

#### Scenario: Extension knows source message key
- **WHEN** an image artifact sync payload includes `capturedMessageSourceKey`
- **THEN** the backend resolves it to the matching captured message row after message upsert
- **AND** stores the artifact with `capturedMessageId`

#### Scenario: Same image observed repeatedly
- **WHEN** the same source image artifact is observed in multiple manual or automatic sync batches
- **THEN** Contextbase stores one artifact row for that source image within the captured session
- **AND** repeated observations update mutable metadata rather than inserting duplicates

#### Scenario: Message association unavailable
- **WHEN** an image artifact cannot be associated with a specific message
- **THEN** Contextbase stores it as a session-level artifact
- **AND** the transcript UI can still show it without attaching it to the wrong message

### Requirement: Workspace-Scoped Artifact Reads
Contextbase SHALL expose captured image artifacts to the web UI through workspace-scoped Zero reads.

#### Scenario: Artifact query uses active workspace
- **WHEN** the web UI reads artifacts for a captured session
- **THEN** the query filters by the active workspace id and requested captured session id
- **AND** it returns no artifacts from other workspaces

#### Scenario: Artifact query has deterministic order
- **WHEN** multiple artifacts exist for a captured session
- **THEN** the query returns them in deterministic display order
- **AND** repeated renders do not reorder image thumbnails unexpectedly

### Requirement: Transcript Image Rendering
Contextbase SHALL render captured image artifacts inline in the captured chat transcript.

#### Scenario: Message-level image artifact
- **WHEN** a captured message has one or more associated image artifacts with `fileObjectId`
- **THEN** the transcript renders image thumbnails below that message
- **AND** the thumbnails use Contextbase file content URLs
- **AND** clicking a thumbnail opens an image preview or equivalent existing file preview

#### Scenario: Multiple images on one message
- **WHEN** a captured message has multiple image artifacts
- **THEN** the transcript renders them as a compact responsive grid
- **AND** the grid remains inside the Otto-style centered transcript column
- **AND** the layout does not overflow on mobile widths

#### Scenario: Session-level image artifact
- **WHEN** an image artifact has no associated `capturedMessageId`
- **THEN** the transcript renders it in a secondary session images section
- **AND** it is not incorrectly attached to an unrelated message

#### Scenario: Inline markdown image
- **WHEN** captured message content contains Contextbase image markdown
- **THEN** the existing markdown renderer displays the inline image
- **AND** artifact rendering does not duplicate the same image when the source artifact key matches an already rendered inline file reference

#### Scenario: Artifact without available file
- **WHEN** an image artifact lacks a usable `fileObjectId`
- **THEN** the transcript renders a compact unavailable artifact card
- **AND** it does not render a broken `<img>` element

### Requirement: Captured Chat Image Verification
Contextbase SHALL include automated verification for image capture, storage, and transcript display.

#### Scenario: API and storage tests
- **WHEN** backend tests run
- **THEN** they cover capture-token image upload, type/size rejection, workspace scoping, and artifact association by source message key

#### Scenario: Extension tests
- **WHEN** browser-extension tests run
- **THEN** they cover extracting visible images, generating stable artifact keys, retrying repeated observations idempotently, and recording image failure diagnostics

#### Scenario: Web UI tests
- **WHEN** web tests run
- **THEN** they cover Zero artifact reads, message-level image rendering, session-level image rendering, unavailable artifact rendering, and absence of provider URL hotlinks

#### Scenario: End-to-end fixture
- **WHEN** the extension E2E fixture syncs a supported chat page containing an image
- **THEN** Contextbase stores an image file and artifact row
- **AND** the captured chat transcript renders the image from a Contextbase file URL
