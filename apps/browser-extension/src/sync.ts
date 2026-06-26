import type {
  SessionCaptureArtifactInput,
  SessionCaptureFileUploadResponse,
  SessionCaptureManualSyncBody,
  SessionCaptureManualSyncResponse,
} from "@contextbase/contracts"
import { toManualSyncPayload } from "./providers/chatgpt"
import { fetchImageArtifactData, imageBytesAsArrayBuffer } from "./providers/image-artifacts"
import type { ExtractedArtifact, ExtractedSession } from "./providers/types"
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
    const payload = await buildSyncPayloadWithUploadedArtifacts(config, extracted, fetchFn)
    if (!payload.ok) return payload

    const response = await fetchFn(
      new URL("/api/v1/session-capture/sync/manual", normalizeApiBaseUrl(config.apiBaseUrl)),
      {
        body: JSON.stringify(payload.data),
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

async function buildSyncPayloadWithUploadedArtifacts(
  config: Pick<ExtensionConfig, "apiBaseUrl" | "captureToken">,
  extracted: ExtractedSession,
  fetchFn: typeof fetch,
): Promise<{ data: SessionCaptureManualSyncBody; ok: true } | SyncFailure> {
  const payload = toManualSyncPayload(extracted)
  if (!extracted.artifacts?.length) return { data: payload, ok: true }

  const uploadedArtifacts: SessionCaptureArtifactInput[] = []
  for (const artifact of extracted.artifacts) {
    const uploaded = await uploadArtifactFile(config, artifact, fetchFn)
    if (!uploaded.ok) return uploaded
    uploadedArtifacts.push(uploaded.data)
  }

  return {
    data: {
      ...payload,
      artifacts: uploadedArtifacts,
    },
    ok: true,
  }
}

async function uploadArtifactFile(
  config: Pick<ExtensionConfig, "apiBaseUrl" | "captureToken">,
  artifact: ExtractedArtifact,
  fetchFn: typeof fetch,
): Promise<{ data: SessionCaptureArtifactInput; ok: true } | SyncFailure> {
  const imageData = artifact.imageData ?? (await fetchImageArtifactData(artifact, fetchFn))
  if (!imageData) {
    const { imageData: _imageData, imageFetchUrl: _imageFetchUrl, ...artifactInput } = artifact
    return { data: artifactInput, ok: true }
  }

  const formData = new FormData()
  const fileBody = imageBytesAsArrayBuffer(imageData.bytes)
  formData.set(
    "file",
    new File([fileBody], imageData.filename, {
      type: imageData.contentType,
    }),
  )
  if (artifact.sourceArtifactKey) formData.set("sourceArtifactKey", artifact.sourceArtifactKey)

  const response = await fetchFn(
    new URL("/api/v1/session-capture/files", normalizeApiBaseUrl(config.apiBaseUrl)),
    {
      body: formData,
      headers: {
        authorization: `Bearer ${config.captureToken}`,
      },
      method: "POST",
    },
  )
  const body = (await response.json()) as SessionCaptureFileUploadResponse | ApiErrorEnvelope

  if (!response.ok || body.ok !== true) {
    return {
      error: body.ok === false ? body.error.message : "Image upload failed",
      ok: false,
      status: response.status,
    }
  }

  const { imageData: _imageData, imageFetchUrl: _imageFetchUrl, ...artifactInput } = artifact
  return {
    data: {
      ...artifactInput,
      contentType: body.data.contentType,
      fileObjectId: body.data.fileObjectId,
    },
    ok: true,
  }
}

type ApiErrorEnvelope = {
  error: { code: string; message: string }
  ok: false
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}
