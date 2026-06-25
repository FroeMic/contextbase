# Agent Guidelines For Contextbase

## Engineering Preferences

- Preserve workspace scoping as the primary data ownership boundary. New user-visible product data must be tied to a workspace unless a spec explicitly says otherwise.
- Use Zero for web app reads of replicated, client-readable workspace data.
- Use tRPC for web app writes and procedural browser-session/settings operations.
- Keep Zero mutators disabled unless a future OpenSpec change explicitly enables them.
- Use the API service with contracts and `@contextbase/api-client` for external clients, CLI, MCP, browser-extension ingestion, and integration APIs.
- Do not route browser-extension ingestion through web tRPC.
- Capture architectural preferences in OpenSpec when they affect system behavior or future implementation choices.

## Git Workflow

- When merging pull requests, always use merge commits. Never squash or rebase merges into `main`.
