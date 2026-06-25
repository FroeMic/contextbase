import { createCaptureFlowController, type ExtractCurrentSessionMessage } from "../extension-flow"
import { chromeStorageArea, getExtensionConfig, saveLastSyncStatus } from "../storage"
import { syncExtractedSession } from "../sync"

const CAPTURE_ACTIVE_TAB = "contextbase.captureActiveTab"

type RuntimeMessage = {
  tabId?: number
  type: typeof CAPTURE_ACTIVE_TAB
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (response: unknown) => void) => {
    if (message.type !== CAPTURE_ACTIVE_TAB) return false

    captureActiveTab(message.tabId)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : "Capture failed",
          ok: false,
        })
      })

    return true
  },
)

async function captureActiveTab(tabId?: number) {
  const storage = chromeStorageArea(chrome.storage.local)
  const controller = createCaptureFlowController({
    getActiveTab: async () => {
      if (tabId !== undefined) {
        return chrome.tabs.get(tabId)
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab ?? null
    },
    getConfig: () => getExtensionConfig(storage),
    sendTabMessage: (tabId, message: ExtractCurrentSessionMessage) =>
      chrome.tabs.sendMessage(tabId, message) as Promise<never>,
    syncExtractedSession: async (config, extracted) => {
      const result = await syncExtractedSession(config, extracted)
      await saveLastSyncStatus(
        storage,
        result.ok
          ? {
              capturedSessionId: result.capturedSessionId,
              messageCount: result.messageCount,
              status: "accepted",
              syncedAt: new Date().toISOString(),
            }
          : {
              error: result.error,
              status: "failed",
              syncedAt: new Date().toISOString(),
            },
      )
      return result
    },
  })

  return controller.captureActiveTab()
}
