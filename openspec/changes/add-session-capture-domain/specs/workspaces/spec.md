## MODIFIED Requirements

### Requirement: Workspace Membership
Contextbase SHALL keep users, workspaces, memberships, invitations, workspace roles, and captured sessions under the workspace access boundary.

#### Scenario: Workspace-scoped access
- **WHEN** a user accesses workspace data
- **THEN** the request is evaluated against the user's active workspace membership
- **AND** workspace members only see data scoped to authorized workspaces

#### Scenario: Captured session access
- **WHEN** a user accesses a captured session, captured message, artifact, sync event, or source snapshot
- **THEN** Contextbase authorizes the request through the owning workspace membership
- **AND** users without membership in the owning workspace cannot access the captured data
