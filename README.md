# Contextbase

Contextbase is a workspace-based foundation for local-first capture and management of AI chat,
coding, and agent sessions.

This baseline keeps the generic SaaS/workspace infrastructure from the copied source
application:

- Auth, signup, login, onboarding, and browser sessions.
- Workspace creation, switching, membership, invitations, and authorization.
- Account and workspace settings.
- API, web, auth, and MCP services.
- Postgres, Drizzle, Zero schema, Docker, and local-domain development.
- File storage with local disk/S3-compatible providers.

Provider-specific session capture will be added through OpenSpec changes. The initial baseline
intentionally does not include any provider ingestion implementation yet.

## Local Development

```sh
pnpm install
pnpm typecheck
pnpm dev:web
```

Docker/Postgres stack:

```sh
pnpm docker:local:dev
```

Local domain stack:

```sh
pnpm local:domains:docker
```
