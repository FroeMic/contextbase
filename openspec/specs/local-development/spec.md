# Local Development

## Purpose
Define the retained Contextbase local development baseline for Docker Compose, migrations, local domains, and portless integration.

## Requirements

### Requirement: Docker Stack
Contextbase SHALL provide a local Docker Compose stack for Postgres, migrations, API, auth, web, MCP, and Zero cache.

#### Scenario: Local stack startup
- **WHEN** `pnpm docker:local:dev` or the local-domain Docker script is run
- **THEN** services use Contextbase names, database credentials, volumes, and local domains
- **AND** removed provider runtime services are not started

### Requirement: Portless Local Domains
Contextbase SHALL retain the portless/local-domain development workflow under Contextbase hostnames.

#### Scenario: Contextbase local hostnames
- **WHEN** local-domain tooling is run
- **THEN** web, API, uploads, Zero, auth, MCP, and console hosts use `contextbase` local-domain names
