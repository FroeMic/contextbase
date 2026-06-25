import {
  chromeStorageArea,
  clearExtensionConfig,
  getExtensionConfig,
  pairCaptureClient,
  saveCaptureTokenConfig,
} from "../storage"

const CAPTURE_ACTIVE_TAB = "contextbase.captureActiveTab"

const storage = chromeStorageArea(chrome.storage.local)

const elements = {
  apiBaseUrl: requireElement<HTMLInputElement>("apiBaseUrl"),
  apiToken: requireElement<HTMLInputElement>("apiToken"),
  captureToken: requireElement<HTMLInputElement>("captureToken"),
  capture: requireElement<HTMLButtonElement>("capture"),
  clear: requireElement<HTMLButtonElement>("clear"),
  pair: requireElement<HTMLButtonElement>("pair"),
  pasteToken: requireElement<HTMLButtonElement>("pasteToken"),
  status: requireElement<HTMLElement>("status"),
}

void render()

elements.pair.addEventListener("click", async () => {
  await runWithStatus("Pairing extension...", async () => {
    await pairCaptureClient(storage, {
      apiBaseUrl: elements.apiBaseUrl.value,
      apiToken: elements.apiToken.value,
      label: "Contextbase Browser Extension",
    })
    elements.apiToken.value = ""
    await render("Paired. Capture token stored.")
  })
})

elements.pasteToken.addEventListener("click", async () => {
  await runWithStatus("Saving capture token...", async () => {
    await saveCaptureTokenConfig(storage, {
      apiBaseUrl: elements.apiBaseUrl.value,
      captureToken: elements.captureToken.value,
    })
    elements.captureToken.value = ""
    await render("Capture token stored.")
  })
})

elements.clear.addEventListener("click", async () => {
  await clearExtensionConfig(storage)
  await render("Configuration cleared.")
})

elements.capture.addEventListener("click", async () => {
  await runWithStatus("Capturing current tab...", async () => {
    const response = await chrome.runtime.sendMessage({ type: CAPTURE_ACTIVE_TAB })
    const result = response as { error?: string; messageCount?: number; ok?: boolean } | undefined
    if (!result?.ok) {
      throw new Error(result?.error ?? "Capture failed")
    }
    await render(`Captured ${result.messageCount ?? 0} messages.`)
  })
})

async function render(message?: string) {
  const config = await getExtensionConfig(storage)
  if (config) {
    elements.apiBaseUrl.value = config.apiBaseUrl
  }
  elements.capture.disabled = !config
  elements.status.textContent =
    message ??
    (config
      ? `Connected to ${config.apiBaseUrl}${config.lastSync ? `; last sync ${config.lastSync.status}` : ""}`
      : "Configure Contextbase to enable capture.")
}

async function runWithStatus(message: string, fn: () => Promise<void>) {
  elements.status.textContent = message
  try {
    await fn()
  } catch (error) {
    elements.status.textContent = error instanceof Error ? error.message : "Action failed"
  }
}

function requireElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing popup element: ${id}`)
  return element as T
}
