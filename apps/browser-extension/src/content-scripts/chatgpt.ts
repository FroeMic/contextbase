import { EXTRACT_CURRENT_SESSION, type ExtractCurrentSessionMessage } from "../extension-flow"
import { extractChatGptSession } from "../providers/chatgpt"

chrome.runtime.onMessage.addListener(
  (message: ExtractCurrentSessionMessage, _sender, sendResponse: (response: unknown) => void) => {
    if (message.type !== EXTRACT_CURRENT_SESSION) return false

    try {
      sendResponse({
        extracted: extractChatGptSession(document, new URL(window.location.href)),
        ok: true,
      })
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : "Failed to extract ChatGPT session",
        ok: false,
      })
    }

    return false
  },
)
