import type { ExtractCurrentSessionMessage, ExtractCurrentSessionResponse } from "../extension-flow"

const CHATGPT_CONTENT_SCRIPT_FILE = "content-scripts/chatgpt.js"

type ManualCaptureChromeApi = {
  executeScript: (details: { files: string[]; target: { tabId: number } }) => Promise<unknown>
  sendMessage: (
    tabId: number,
    message: ExtractCurrentSessionMessage,
  ) => Promise<ExtractCurrentSessionResponse>
}

export async function sendTabMessageWithContentScriptRecovery(
  chromeApi: ManualCaptureChromeApi,
  tabId: number,
  message: ExtractCurrentSessionMessage,
) {
  try {
    return await chromeApi.sendMessage(tabId, message)
  } catch (error) {
    if (!isMissingReceivingEndError(error)) throw error
  }

  await chromeApi.executeScript({
    files: [CHATGPT_CONTENT_SCRIPT_FILE],
    target: { tabId },
  })

  return chromeApi.sendMessage(tabId, message)
}

function isMissingReceivingEndError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Could not establish connection") &&
    error.message.includes("Receiving end does not exist")
  )
}
