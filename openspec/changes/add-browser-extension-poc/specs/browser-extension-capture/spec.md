## ADDED Requirements

### Requirement: Local Extension Build
Contextbase SHALL provide a WXT, React, and TypeScript Chromium Manifest V3 browser-extension app that can be built and loaded locally as an unpacked extension.

#### Scenario: Build artifact
- **WHEN** the browser-extension build command is run
- **THEN** it produces an unpacked extension directory containing `manifest.json`, popup assets, a background service worker, and provider content scripts
- **AND** the output directory can be loaded through Chromium's "Load unpacked" extension flow

#### Scenario: Workspace integration
- **WHEN** repo-wide lint, typecheck, and test commands run
- **THEN** the browser-extension app participates in the same workspace verification pattern as other runnable apps

#### Scenario: WXT generated manifest
- **WHEN** the extension build command runs
- **THEN** WXT generates the Manifest V3 `manifest.json` from checked-in config and entrypoints
- **AND** the generated manifest includes the popup, background service worker, ChatGPT content script matches, and minimal required permissions

### Requirement: Extension Configuration And Pairing
The browser extension SHALL support local setup with a Contextbase API base URL and workspace-scoped capture token.

#### Scenario: Pair with API token
- **WHEN** the user enters a Contextbase API base URL and a temporary API token with manage permission
- **THEN** the extension creates a capture client through the session-capture pairing endpoint
- **AND** stores only the API base URL and returned capture token after pairing succeeds

#### Scenario: Paste existing capture token
- **WHEN** the user enters a Contextbase API base URL and an existing capture token
- **THEN** the extension stores those values for manual sync
- **AND** does not require a broad Contextbase API token

#### Scenario: Clear configuration
- **WHEN** the user clears extension configuration
- **THEN** stored API base URL, capture token, and last sync status are removed from extension storage

#### Scenario: React popup state
- **WHEN** the popup renders configuration, pairing, capture, success, and failure states
- **THEN** those states are implemented through React components backed by typed extension services
- **AND** user-facing token guidance distinguishes temporary API tokens from existing capture tokens
- **AND** temporary Contextbase API tokens use the `cbt_` prefix while capture-client tokens use the `cbc_` prefix

#### Scenario: Guided setup
- **WHEN** the extension is not configured
- **THEN** the popup guides the user through one selected setup path at a time
- **AND** pairing with a temporary API token and saving an existing capture token are not shown as simultaneous required fields
- **AND** the capture action is shown after a capture token has been stored

### Requirement: ChatGPT Visible Session Extraction
The browser extension SHALL extract the currently visible ChatGPT conversation without crawling hidden provider history.

#### Scenario: Supported ChatGPT tab
- **WHEN** the active tab URL is under `https://chatgpt.com/` or `https://chat.openai.com/`
- **THEN** the extension identifies the tab as a ChatGPT capture target
- **AND** enables the manual capture action

#### Scenario: Unsupported tab
- **WHEN** the active tab is not a supported provider page
- **THEN** the extension disables capture
- **AND** shows a provider-not-supported status

#### Scenario: Extract visible conversation
- **WHEN** manual capture is triggered on a supported ChatGPT conversation page
- **THEN** the content script extracts the source URL, provider key, conversation title when visible, ordered messages, message roles, message text, provider message IDs when available, and parser version
- **AND** includes a raw structured source snapshot for debugging and future parser updates

#### Scenario: No provider credentials
- **WHEN** the content script extracts a session
- **THEN** it does not read, collect, or send provider cookies, provider access tokens, provider localStorage dumps, or hidden account data

### Requirement: Manual Sync To Contextbase
The browser extension SHALL sync extracted sessions through the existing session-capture manual sync API.

#### Scenario: Successful manual sync
- **WHEN** the user captures a supported ChatGPT session with valid extension configuration
- **THEN** the extension sends a `SessionCaptureManualSyncBody` payload to `POST /api/v1/session-capture/sync/manual`
- **AND** authenticates with the stored capture token
- **AND** displays the accepted sync result including message count and captured session ID when available

#### Scenario: Repeated manual sync
- **WHEN** the user captures the same ChatGPT session more than once
- **THEN** the extension sends stable source session and message identifiers when available
- **AND** repeated syncs update the backend without intentionally creating duplicate messages

#### Scenario: Sync failure
- **WHEN** Contextbase rejects the sync request or the API is unavailable
- **THEN** the extension displays a useful error status
- **AND** does not discard the stored configuration

### Requirement: Extension Security Boundary
The browser extension SHALL keep Contextbase credentials scoped and isolate provider-page code from stored capture tokens.

#### Scenario: Content script token isolation
- **WHEN** a provider content script extracts session data
- **THEN** it does not receive the stored capture token
- **AND** token-bearing API requests are performed by extension-owned popup or background/service-worker code

#### Scenario: Limited permissions
- **WHEN** the extension manifest is built
- **THEN** host permissions are limited to supported provider origins and configured Contextbase API origins needed for the PoC
- **AND** permissions do not include broad all-site access

### Requirement: Extension End-To-End Verification
The browser extension SHALL include automated E2E verification for the complete local manual-capture flow.

#### Scenario: Manual capture E2E
- **WHEN** the E2E test runs
- **THEN** it builds and loads the unpacked WXT extension in Chromium
- **AND** serves or opens a fixture ChatGPT-like conversation page
- **AND** performs a manual capture through extension UI or extension runtime messaging
- **AND** verifies that the local Contextbase API accepts the sync request

#### Scenario: Database result E2E
- **WHEN** the E2E sync succeeds against the local stack
- **THEN** the test verifies the captured session and messages exist in session-capture database tables scoped to the paired workspace

### Requirement: Local Zero Publication Readiness
The local web stack SHALL verify that the running database and Zero publication match the generated Zero client schema before the web app is considered working.

#### Scenario: Session-capture tables replicated
- **WHEN** the local Docker/web/Zero stack is started for this PoC
- **THEN** migrations have created the session-capture tables in the active database
- **AND** the Zero publication includes the session-capture tables referenced by the generated Zero schema
