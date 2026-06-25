## 1. Domain Schema And Migration

- [ ] 1.1 Add `packages/core/src/domains/session-capture/schema.ts` with providers, capture clients, captured sessions, messages, artifacts, source snapshots, sync batches, and sync events.
- [ ] 1.2 Export the session-capture schema from `packages/core/src/db/schema.ts` and `packages/core/src/index.ts`.
- [ ] 1.3 Add schema tests for workspace foreign keys, unique constraints, idempotency keys, enum values, and timestamp fields.
- [ ] 1.4 Generate and review a Drizzle migration for the new session-capture tables.

## 2. Core Repository And Service

- [ ] 2.1 Add repository methods to create/read capture clients, upsert captured sessions, upsert messages/artifacts, store source snapshots, and record sync events.
- [ ] 2.2 Add service logic for workspace-scoped, write-limited capture-client authorization and manual sync batch ingestion.
- [ ] 2.3 Implement idempotency using provider session identifiers when available and deterministic fingerprints when provider IDs are absent, including updates for changed source-message content.
- [ ] 2.4 Add service and repository tests covering first sync, repeated sync without duplicates, edited message updates, appended messages, workspace isolation, write-limited client permissions, and rejected invalid clients.

## 3. Contracts And API Client

- [ ] 3.1 Add `packages/contracts/src/domains/session-capture/contract.ts` for capture-client pairing primitives, sync batch input, sync result output, session/message/artifact DTOs, and structured errors.
- [ ] 3.2 Export session-capture contracts from the contracts package and add package export tests.
- [ ] 3.3 Add `packages/api-client/src/domains/session-capture.ts` helper methods for pairing and manual sync endpoints.
- [ ] 3.4 Add API-client tests for request paths, payloads, response parsing, and error envelopes.

## 4. API Routes

- [ ] 4.1 Add `apps/api/src/domains/session-capture/routes.ts` with endpoints for capture-client pairing/status and manual sync ingestion.
- [ ] 4.2 Wire the session-capture router into `apps/api/src/app.ts` with the same authentication/error patterns as existing domains.
- [ ] 4.3 Enforce workspace authorization for user-facing reads and capture-client workspace scope for ingestion writes.
- [ ] 4.4 Add route tests for successful manual sync, repeated sync, edited message update, cross-workspace rejection, write-limited client permissions, invalid token rejection, and validation failures.

## 5. Zero Schema And Product Surface

- [ ] 5.1 Extend `packages/zero-schema` with session-capture tables/relationships needed by the web app.
- [ ] 5.2 Add Zero schema tests for captured sessions, messages, artifacts, snapshots, and workspace ownership.
- [ ] 5.3 Update product-surface contract tests so the new backend capability is recognized without adding provider-specific UI.

## 6. Verification

- [ ] 6.1 Run `pnpm db:generate` or the repository's migration generation flow and inspect the generated SQL.
- [ ] 6.2 Run `pnpm lint`.
- [ ] 6.3 Run `pnpm typecheck`.
- [ ] 6.4 Run `pnpm test`.
- [ ] 6.5 Validate the OpenSpec change with `openspec validate add-session-capture-domain`.
