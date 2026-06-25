# Workspaces

## Purpose
Define the retained Contextbase workspace model, membership boundary, management surfaces, and authorization expectations.

## Requirements

### Requirement: Workspace Membership
Contextbase SHALL keep users, workspaces, memberships, invitations, and workspace roles as the primary access boundary.

#### Scenario: Workspace-scoped access
- **WHEN** a user accesses workspace data
- **THEN** the request is evaluated against the user's active workspace membership
- **AND** workspace members only see data scoped to authorized workspaces

### Requirement: Workspace Management
Contextbase SHALL keep workspace settings, member management, invitation management, and workspace switching.

#### Scenario: Settings shell
- **WHEN** a signed-in user opens workspace settings
- **THEN** the app renders retained account, workspace, and developer settings pages
- **AND** the settings shell remains nested under the active workspace route
