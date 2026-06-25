# Zero Session Capture Publication Debug

## Symptom

The web app at `https://contextbase.localhost/app/core` connected to Zero with a generated client schema that referenced session-capture tables, but the running Zero cache reported only the old baseline replicated table set and returned `SchemaVersionNotSupported`.

## Root Cause

The running `contextbase-dev` Docker stack was using a database where the session-capture migration had not run. Docker Compose had kept a completed one-shot `migrate` container from before the migration existed, so restarting the stack did not apply the new migration or update the Zero publication.

## Fix

- Added `scripts/local-domains-docker.mjs` so local-domain startup starts Postgres, runs a fresh migration container, verifies/repairs the Zero publication, then starts app services and recreates Zero cache.
- Updated local-domain package scripts to use the new startup script.
- Repaired the active `contextbase-dev` stack by rerunning migration, verifying `_contextbase_public_0`, and recreating `zero-cache`.

## Evidence

- `contextbase-dev` database now contains `capture_clients`, `capture_providers`, `captured_sessions`, `captured_session_messages`, `captured_session_artifacts`, `captured_session_source_snapshots`, `session_capture_sync_batches`, and `session_capture_sync_events`.
- `_contextbase_public_0` now includes the session-capture tables used by the generated Zero schema.
- Zero logs show `zero-cache ready`; recent logs no longer show `SchemaVersionNotSupported`.
- API smoke sync inserted `Live Stack Smoke` into workspace `core`.

## Regression Test

- `packages/core/src/db/local-stack-readiness.test.ts`

## Status

DONE
