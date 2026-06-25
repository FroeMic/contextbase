# Storage

## Purpose
Define the retained Contextbase generic file storage baseline for workspace/user-owned files and provider configuration.

## Requirements

### Requirement: Workspace Files
Contextbase SHALL retain generic file storage for avatars and workspace files.

#### Scenario: File ownership
- **WHEN** a file object is stored
- **THEN** it is scoped to a user or workspace
- **AND** file usage is limited to retained generic usage kinds

### Requirement: Storage Providers
Contextbase SHALL keep local disk and S3-compatible storage configuration.

#### Scenario: Local development storage
- **WHEN** the local stack is started
- **THEN** uploaded files are stored through the configured Contextbase storage provider
