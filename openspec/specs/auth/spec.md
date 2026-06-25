# Auth

## Purpose
Define the retained Contextbase authentication baseline for browser sessions, onboarding, API tokens, and OAuth clients.

## Requirements

### Requirement: Browser Authentication
Contextbase SHALL support browser-based signup, login, logout, onboarding, and session validation.

#### Scenario: Authenticated session access
- **WHEN** a user signs in with a valid browser session
- **THEN** Contextbase exposes the user's active workspace context
- **AND** includes the user's workspace memberships and feature-flag snapshot

### Requirement: API And OAuth Credentials
Contextbase SHALL support workspace-scoped API tokens and OAuth clients using Contextbase scopes.

#### Scenario: Token scoping
- **WHEN** an API token or OAuth grant is created
- **THEN** supported scopes are limited to `contextbase:read`, `contextbase:write`, `contextbase:files`, `contextbase:manage`, and `offline_access` where applicable
- **AND** removed provider-specific scopes are not accepted
