import type { SessionCaptureManualSyncResponse } from "@contextbase/contracts"
import { toManualSyncPayload } from "./providers/chatgpt"
import type { ExtractedSession } from "./providers/types"
import type { ExtensionConfig } from "./storage"

export type SyncSuccess = {
  artifactCount?: number
  capturedSessionId: string
  messageCount: number
  ok: true
  syncBatchId?: string
  syncStatus: "accepted"
}

export type SyncFailure = {
  error: string
  ok: false
  status?: number
}

export async function syncExtractedSession(
  config: Pick<ExtensionConfig, "apiBaseUrl" | "captureToken">,
  extracted: ExtractedSession,
  fetchFn: typeof fetch = fetch,
): Promise<SyncSuccess | SyncFailure> {
  try {
    const response = await fetchFn(
      new URL("/api/v1/session-capture/sync/manual", normalizeApiBaseUrl(config.apiBaseUrl)),
      {
        body: JSON.stringify(toManualSyncPayload(extracted)),
        headers: {
          authorization: `Bearer ${config.captureToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      },
    )
    const body = (await response.json()) as SessionCaptureManualSyncResponse | ApiErrorEnvelope

    if (!response.ok || body.ok !== true) {
      return {
        error: body.ok === false ? body.error.message : "Session sync failed",
        ok: false,
        status: response.status,
      }
    }

    const result: SyncSuccess = {
      capturedSessionId: body.data.capturedSessionId,
      messageCount: body.data.messageCount,
      ok: true,
      syncStatus: body.data.syncStatus,
    }
    if (body.data.artifactCount !== undefined) result.artifactCount = body.data.artifactCount
    if (body.data.syncBatchId !== undefined) result.syncBatchId = body.data.syncBatchId
    return result
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Session sync failed",
      ok: false,
    }
  }
}

type ApiErrorEnvelope = {
  error: { code: string; message: string }
  ok: false
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}
