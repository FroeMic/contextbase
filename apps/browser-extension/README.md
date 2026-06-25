# Contextbase Browser Extension

This app builds the local WXT + React + TypeScript Manifest V3 browser-extension PoC
for manually capturing the currently visible ChatGPT session into Contextbase.

## Build

```sh
pnpm --filter @contextbase/browser-extension build
```

The loadable extension is written to:

```text
apps/browser-extension/dist
```

## Development

```sh
pnpm --filter @contextbase/browser-extension dev
pnpm --filter @contextbase/browser-extension test
pnpm --filter @contextbase/browser-extension e2e
```

## Local Install

1. Start Contextbase locally and bootstrap a workspace/API token.
2. Open Chromium or Chrome at `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select `apps/browser-extension/dist`.
6. Open a ChatGPT conversation tab.
7. Open the Contextbase extension popup.
8. Enter the API base URL, usually `https://api.contextbase.localhost` for the local-domain stack or `http://127.0.0.1:3517` for the direct API port.
9. Use one setup path:
   - **Pair with API token**: paste a temporary `cbt_...` Contextbase API token. The extension exchanges it for a `cbc_...` capture token and stores only that capture token.
   - **Use existing capture token**: paste a previously created `cbc_...` capture token directly.
10. Click **Capture Current Session**.

The PoC intentionally captures only the current visible ChatGPT session. It does not crawl
history, run background sync, or collect provider cookies/tokens.
