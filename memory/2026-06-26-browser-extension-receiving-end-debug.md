# Browser Extension Receiving-End Debug

Date: 2026-06-26

## Symptom

Manual capture from the Contextbase browser extension failed with:

`Could not establish connection. Receiving end does not exist.`

## Root Cause

The background service worker sent `contextbase.extractCurrentSession` to a ChatGPT tab with `chrome.tabs.sendMessage`, but the ChatGPT content script was not loaded in that tab. This happens when the extension is installed or reloaded after the ChatGPT tab is already open. Chrome content scripts are injected on matching navigations, not retroactively into every already-open page.

## Fix

Added `sendTabMessageWithContentScriptRecovery` in `apps/browser-extension/src/background/manual-capture-messaging.ts`.

The service worker now:

1. Sends the extraction message normally.
2. If Chrome returns the specific missing receiving-end error, injects `content-scripts/chatgpt.js` into the tab with `chrome.scripting.executeScript`.
3. Retries the extraction message once.

The extension manifest now requests the `scripting` permission in `apps/browser-extension/wxt.config.ts`.

## Evidence

Regression tests failed before implementation:

- Missing helper import in `manual-capture-messaging.test.ts`.
- Missing `"scripting"` permission in `wxt-app.test.ts`.

Verification after implementation:

- `pnpm --filter @contextbase/browser-extension test`
- `pnpm --filter @contextbase/browser-extension typecheck`
- `pnpm lint`
- `pnpm --filter @contextbase/browser-extension e2e`

All passed.

## Regression Test

`apps/browser-extension/src/background/manual-capture-messaging.test.ts`

The test simulates Chrome throwing `Could not establish connection. Receiving end does not exist.`, verifies the content script file is injected, and verifies the message is retried successfully.

## Status

DONE
