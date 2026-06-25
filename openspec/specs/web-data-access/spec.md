# Web Data Access

## Purpose
Define Contextbase's durable data-access preference for browser web surfaces, replicated reads, procedural writes, and external integration APIs.

## Requirements

### Requirement: Zero For Replicated Web Reads
Contextbase SHALL use Zero for web app reads of replicated, client-readable workspace data when that data is suitable for the Zero schema and query model.

#### Scenario: Workspace read surface
- **WHEN** a web app surface reads replicated workspace data for display
- **THEN** the implementation uses Zero queries where practical
- **AND** the query is scoped through the active workspace context

### Requirement: tRPC For Web Writes And Procedural Browser Operations
Contextbase SHALL use tRPC for browser web app writes and procedural browser-session/settings operations unless a later OpenSpec change explicitly chooses another write path.

#### Scenario: Settings write
- **WHEN** a web settings page updates account, workspace, member, invitation, OAuth, API-token, or security state
- **THEN** the implementation uses a tRPC mutation
- **AND** the mutation enforces the existing browser-session and workspace authorization rules

#### Scenario: Procedural browser read
- **WHEN** a browser web app read is procedural, security-sensitive, not replicated, or not suitable for Zero
- **THEN** the implementation may use tRPC query procedures instead of Zero

### Requirement: Zero Mutators Disabled By Default
Contextbase SHALL keep Zero mutators disabled until an OpenSpec change explicitly introduces and justifies Zero-backed writes.

#### Scenario: Zero mutate endpoint
- **WHEN** a browser request targets the Zero mutate endpoint
- **THEN** Contextbase rejects the request as unsupported
- **AND** application writes continue to use tRPC or the external API path defined for the caller

### Requirement: External Integration APIs Use API Contracts
Contextbase SHALL expose external integrations through the API service, contracts, and API client rather than browser-only tRPC routes.

#### Scenario: Browser extension ingestion
- **WHEN** a browser extension syncs captured sessions into Contextbase
- **THEN** it uses the session-capture ingestion API
- **AND** it does not call web tRPC routes directly

#### Scenario: CLI or MCP integration
- **WHEN** CLI, MCP, or other non-browser clients integrate with Contextbase
- **THEN** they use API-service routes and shared contracts/API client helpers
