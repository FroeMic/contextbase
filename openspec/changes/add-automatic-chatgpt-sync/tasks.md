## 1. Specification And Contracts

- [x] 1.1 Reuse the existing session-capture sync endpoint for automatic sync and add optional observation metadata rather than introducing a new endpoint.
- [x] 1.2 Extend shared contracts with sync mode, observation reason, observed message keys, and coverage boundary metadata.
- [x] 1.3 Add backend tests proving repeated incremental batches upsert messages idempotently and update session coverage conservatively.
- [x] 1.4 Fix sync batch metadata so accepted batches report the actual accepted/upserted message count.
- [x] 1.5 Store coverage metadata through existing session metadata/source snapshot persistence unless tests prove typed columns are required.

## 2. Extension Observation Pipeline

- [x] 2.1 Add extension config for automatic sync state, defaulting to enabled after pairing with a popup toggle to disable it.
- [x] 2.2 Add ChatGPT content-script lifecycle hooks for initial page load, URL/session changes, DOM mutations, scroll events, and tab visibility changes.
- [x] 2.3 Add extraction support for partial observations with stable message keys and observed ordering anchors.
- [x] 2.4 Add conservative `oldestBoundarySeen` and `latestBoundarySeen` detection for current ChatGPT markup.
- [x] 2.5 Ensure content scripts never receive capture tokens or broad API tokens.

## 3. Queueing, Dedupe, And Retry

- [x] 3.1 Add a simple background/service-worker latest-observation queue keyed by workspace, provider, source session, and tab.
- [x] 3.2 Debounce mutation/scroll observations and skip API calls when the observed message key/content fingerprint is unchanged.
- [x] 3.3 Persist last accepted observation fingerprints and last sync status; do not require durable queued delivery across browser restarts in v1.
- [x] 3.4 Add bounded retry/backoff or retry-on-next-observation for failed automatic syncs without losing newer observations.
- [x] 3.5 Surface automatic sync state and last failure in the popup.

## 4. Verification

- [x] 4.1 Add unit tests for automatic observation scheduling, dedupe, debounce, and retry behavior.
- [x] 4.2 Add ChatGPT fixture tests for initial visible sync, scroll-loaded older messages, edited messages, repeated identical text, and URL/session changes.
- [x] 4.3 Add E2E tests that load the built extension, open a fixture ChatGPT page, verify automatic sync without clicking capture, scroll upward to reveal older messages, and verify the older messages are synced idempotently.
- [x] 4.4 Add E2E coverage for conservative boundary detection: unknown when not proven, oldest seen at top, latest seen at bottom.
- [x] 4.5 Run browser-extension tests, E2E, repo lint, typecheck, test, and OpenSpec validation.
