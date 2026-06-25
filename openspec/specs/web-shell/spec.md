# Web Shell

## Purpose
Define the retained Contextbase authenticated web shell, workspace navigation, settings shell, and provider-neutral baseline.

## Requirements

### Requirement: Authenticated Workspace Shell
Contextbase SHALL provide an authenticated app shell for each workspace.

#### Scenario: Workspace overview
- **WHEN** a signed-in user opens `/app/:workspaceSlug`
- **THEN** the app renders the Contextbase workspace frame
- **AND** the frame includes workspace switching, settings access, logout, and a generic overview page

### Requirement: Provider-Neutral Baseline
The baseline web UI SHALL NOT include provider-specific chat ingestion, account linking, QR pairing, sync status, or chat browsing surfaces.

#### Scenario: Clean baseline
- **WHEN** the baseline app is built
- **THEN** provider-specific routes and settings pages are absent
- **AND** future capture UI is added only through later OpenSpec changes
