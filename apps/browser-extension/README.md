# Contextbase Browser Extension

This app builds the local Manifest V3 browser-extension PoC for manually capturing the
currently visible ChatGPT session into Contextbase.

## Build

```sh
pnpm --filter @contextbase/browser-extension build
```

The loadable extension is written to:

```text
apps/browser-extension/dist
```

## Local Install

1. Start Contextbase locally and bootstrap a workspace/API token.
2. Open Chromium or Chrome at `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select `apps/browser-extension/dist`.
6. Open a ChatGPT conversation tab.
7. Open the Contextbase extension popup.
8. Enter the API base URL, usually `http://127.0.0.1:3017`.
9. Pair with a temporary Contextbase API token, or paste an existing capture token.
10. Click **Capture Current Session**.

The PoC intentionally captures only the current visible ChatGPT session. It does not crawl
history, run background sync, or collect provider cookies/tokens.
