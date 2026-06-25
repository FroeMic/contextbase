## Why

The browser-extension PoC can manually capture the currently visible ChatGPT conversation, but the target product behavior is a passive development/context tool: when a user opens or works inside a ChatGPT session, Contextbase should keep the workspace copy current without requiring a manual capture click every time.

ChatGPT also virtualizes long conversations. A tab may initially expose only the latest visible portion of a session. If the user scrolls upward and older messages enter the DOM later, those messages must sync too without duplicating messages already stored.

## What Changes

- Add automatic ChatGPT sync for configured extension installs.
- Observe supported ChatGPT tabs after setup and sync visible/newly discovered messages without a popup click.
- Track per-tab/per-session extraction state so repeated DOM observations are debounced and idempotent.
- Treat every discovered message as an upsert keyed by stable provider IDs when available, with deterministic fallbacks when not.
- Sync older messages discovered through scroll or lazy loading.
- Record coverage metadata so Contextbase can distinguish partial captures from sessions where the extension has observed the oldest/top boundary and/or latest/bottom boundary.
- Keep manual capture as a user-triggered force sync/debug action.
- Add extension-side diagnostics for automatic sync status, queue state, and last failure.
- Keep the first implementation intentionally small: reuse the existing sync endpoint, store coverage in metadata/snapshots unless typed columns become necessary, and implement simple bounded retry before adding durable background queue complexity.

## Capabilities

### New Capabilities

- `automatic-session-sync`: Defines automatic open-tab ChatGPT observation, incremental/idempotent sync, scroll-loaded message handling, coverage-boundary detection, and verification behavior.

### Modified Capabilities

- None.

## Impact

- Extends `apps/browser-extension` content/background behavior.
- Extends session-capture contracts with optional sync metadata such as `syncMode`, `observedMessageKeys`, and coverage boundary fields.
- Prefer existing session metadata/source snapshots for coverage persistence in the first implementation; add typed columns only if tests or web querying require them.
- Adds E2E tests for automatic sync on page open, repeated observations, scroll-loaded older messages, and boundary detection.
- Does not crawl the ChatGPT sidebar, open hidden sessions, collect provider credentials, or sync tabs the user has not opened.
