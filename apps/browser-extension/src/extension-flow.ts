import { detectChatGptProvider } from "./providers/chatgpt"
import type { ExtractedSession } from "./providers/types"
import type { ExtensionConfig } from "./storage"
import type { SyncFailure, SyncSuccess } from "./sync"

export const EXTRACT_CURRENT_SESSION = "contextbase.extractCurrentSession"

export type BrowserTab = {
  id?: number
  url?: string
}

export type ExtractCurrentSessionMessage = {
  type: typeof EXTRACT_CURRENT_SESSION
}

export type ExtractCurrentSessionResponse =
  | { error: string; ok: false }
  | { extracted: ExtractedSession; ok?: true }

export type CaptureFlowDependencies = {
  getActiveTab: () => Promise<BrowserTab | null>
  getConfig: () => Promise<Pick<ExtensionConfig, "apiBaseUrl" | "captureToken"> | null>
  sendTabMessage: (
    tabId: number,
    message: ExtractCurrentSessionMessage,
  ) => Promise<ExtractCurrentSessionResponse>
  syncExtractedSession: (
    config: Pick<ExtensionConfig, "apiBaseUrl" | "captureToken">,
    extracted: ExtractedSession,
  ) => Promise<SyncSuccessLike | SyncFailure>
}

type SyncSuccessLike = Omit<SyncSuccess, "ok"> & { ok?: true }

export function createCaptureFlowController(dependencies: CaptureFlowDependencies) {
  return {
    captureActiveTab: async () => {
      const config = await dependencies.getConfig()
      if (!config) return { error: "Configure Contextbase before capturing.", ok: false as const }

      const tab = await dependencies.getActiveTab()
      if (!tab?.id || !tab.url || !detectChatGptProvider(new URL(tab.url))) {
        return { error: "Open a supported ChatGPT conversation tab.", ok: false as const }
      }

      const extraction = await dependencies.sendTabMessage(tab.id, {
        type: EXTRACT_CURRENT_SESSION,
      })
      if ("error" in extraction) return { error: extraction.error, ok: false as const }

      const sync = await dependencies.syncExtractedSession(config, extraction.extracted)
      if ("error" in sync) return sync

      return {
        capturedSessionId: sync.capturedSessionId,
        messageCount: sync.messageCount,
        ok: true as const,
        status: sync.syncStatus,
      }
    },
  }
}
