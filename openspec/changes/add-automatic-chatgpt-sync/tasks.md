## 1. Specification And Contracts

- [ ] 1.1 Decide whether automatic sync uses the existing manual sync endpoint with optional metadata or a new automatic/incremental endpoint.
- [ ] 1.2 Extend shared contracts with sync mode, observation reason, observed message keys, and coverage boundary metadata.
- [ ] 1.3 Add backend tests proving repeated incremental batches upsert messages idempotently and update session coverage conservatively.
- [ ] 1.4 Fix sync batch metadata so accepted batches report the actual accepted/upserted message count.

## 2. Extension Observation Pipeline

- [ ] 2.1 Add extension config for automatic sync state, defaulting to enabled after pairing unless product review chooses an explicit toggle.
- [ ] 2.2 Add ChatGPT content-script lifecycle hooks for initial page load, URL/session changes, DOM mutations, scroll events, and tab visibility changes.
- [ ] 2.3 Add extraction support for partial observations with stable message keys and observed ordering anchors.
- [ ] 2.4 Add conservative `oldestBoundarySeen` and `latestBoundarySeen` detection for current ChatGPT markup.
- [ ] 2.5 Ensure content scripts never receive capture tokens or broad API tokens.

## 3. Queueing, Dedupe, And Retry

- [ ] 3.1 Add a background/service-worker sync queue keyed by workspace, provider, source session, and tab.
- [ ] 3.2 Debounce mutation/scroll observations and skip API calls when the observed message key/content fingerprint is unchanged.
- [ ] 3.3 Persist enough queue/last-observation state to survive MV3 service-worker suspension.
- [ ] 3.4 Add bounded retry/backoff for failed automatic syncs without losing newer observations.
- [ ] 3.5 Surface automatic sync state and last failure in the popup.

## 4. Verification

- [ ] 4.1 Add unit tests for automatic observation scheduling, dedupe, debounce, and retry behavior.
- [ ] 4.2 Add ChatGPT fixture tests for initial visible sync, scroll-loaded older messages, edited messages, repeated identical text, and URL/session changes.
- [ ] 4.3 Add E2E tests that load the built extension, open a fixture ChatGPT page, verify automatic sync without clicking capture, scroll upward to reveal older messages, and verify the older messages are synced idempotently.
- [ ] 4.4 Add E2E coverage for conservative boundary detection: unknown when not proven, oldest seen at top, latest seen at bottom.
- [ ] 4.5 Run browser-extension tests, E2E, repo lint, typecheck, test, and OpenSpec validation.
