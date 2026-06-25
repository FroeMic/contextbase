import type { ExtractedSession } from "./providers/types"
import type { ExtensionConfig, LastSyncStatus } from "./storage"
import type { SyncFailure, SyncSuccess } from "./sync"

export const AUTOMATIC_SESSION_OBSERVED = "contextbase.automaticSessionObserved"

export type AutomaticObservationReason =
  | "initial_load"
  | "mutation"
  | "scroll"
  | "manual_force"
  | "retry"

export type AutomaticSessionObservedMessage = {
  extracted: ExtractedSession
  type: typeof AUTOMATIC_SESSION_OBSERVED
}

export type AutomaticSyncConfig = Pick<
  ExtensionConfig,
  "apiBaseUrl" | "captureToken" | "autoSyncEnabled"
>

export type AutomaticSyncDependencies = {
  getAcceptedFingerprint?: (key: string) => Promise<string | undefined>
  getConfig: () => Promise<AutomaticSyncConfig | null>
  saveAcceptedFingerprint?: (key: string, fingerprint: string) => Promise<void>
  saveLastSyncStatus: (status: LastSyncStatus) => Promise<void>
  syncExtractedSession: (
    config: Pick<ExtensionConfig, "apiBaseUrl" | "captureToken">,
    extracted: ExtractedSession,
  ) => Promise<SyncSuccess | SyncFailure>
}

export function withAutomaticObservation(
  extracted: ExtractedSession,
  observationReason: AutomaticObservationReason,
  coverage: {
    latestBoundarySeen?: boolean
    oldestBoundarySeen?: boolean
  } = {},
): ExtractedSession {
  const observedMessageKeys = extracted.messages.map((message) => messageKey(message))

  return {
    ...extracted,
    observation: {
      observationReason,
      observedAt: new Date().toISOString(),
      observedMessageKeys,
      syncMode: "automatic",
      visibleMessageCount: extracted.messages.length,
      ...(coverage.latestBoundarySeen !== undefined
        ? { latestBoundarySeen: coverage.latestBoundarySeen }
        : {}),
      ...(coverage.oldestBoundarySeen !== undefined
        ? { oldestBoundarySeen: coverage.oldestBoundarySeen }
        : {}),
      ...(observedMessageKeys[0] ? { oldestObservedMessageKey: observedMessageKeys[0] } : {}),
      ...(observedMessageKeys.at(-1)
        ? { latestObservedMessageKey: observedMessageKeys.at(-1) }
        : {}),
    },
  }
}

export function createAutomaticSyncController(dependencies: AutomaticSyncDependencies) {
  const acceptedFingerprints = new Map<string, string>()

  return {
    handleObservedSession: async (message: AutomaticSessionObservedMessage) => {
      const config = await dependencies.getConfig()
      if (!config || config.autoSyncEnabled === false) {
        return { ok: true as const, skipped: true as const }
      }

      const key = sessionKey(message.extracted)
      const fingerprint = observationFingerprint(message.extracted)
      const acceptedFingerprint =
        acceptedFingerprints.get(key) ?? (await dependencies.getAcceptedFingerprint?.(key))
      if (acceptedFingerprint === fingerprint) {
        acceptedFingerprints.set(key, fingerprint)
        return { ok: true as const, skipped: true as const }
      }

      const result = await dependencies.syncExtractedSession(config, message.extracted)
      await dependencies.saveLastSyncStatus(
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

      if (!result.ok) return result

      acceptedFingerprints.set(key, fingerprint)
      await dependencies.saveAcceptedFingerprint?.(key, fingerprint)
      return { ok: true as const, skipped: false as const }
    },
  }
}

function sessionKey(extracted: ExtractedSession) {
  return [
    extracted.provider.providerKey,
    extracted.session.sourceSessionKey ??
      extracted.session.sourceSessionId ??
      extracted.session.sourceUrl,
  ].join(":")
}

function observationFingerprint(extracted: ExtractedSession) {
  return JSON.stringify({
    coverage: {
      latestBoundarySeen: extracted.observation?.latestBoundarySeen,
      oldestBoundarySeen: extracted.observation?.oldestBoundarySeen,
    },
    messages: extracted.messages.map((message) => ({
      contentJson: message.contentJson,
      contentText: message.contentText,
      key: messageKey(message),
      role: message.role,
      sequenceNumber: message.sequenceNumber,
    })),
  })
}

function messageKey(message: ExtractedSession["messages"][number]) {
  return (
    message.sourceMessageKey ??
    message.sourceMessageId ??
    `${message.role}:${message.sequenceNumber}:${message.contentText ?? message.contentJson ?? ""}`
  )
}
