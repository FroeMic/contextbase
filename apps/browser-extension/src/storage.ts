import type {
  CaptureClientDto,
  CaptureClientPairResponse,
  SessionCaptureManualSyncResponse,
} from "@contextbase/contracts"

export type ExtensionStorageArea = {
  get: (
    keys?: string[] | Record<string, unknown> | string | null,
  ) => Promise<Record<string, unknown>>
  remove: (keys: string | string[]) => Promise<void>
  set: (items: Record<string, unknown>) => Promise<void>
}

export type ExtensionConfig = {
  apiBaseUrl: string
  autoSyncEnabled: boolean
  captureToken: string
  client?: CaptureClientDto
  lastSync?: LastSyncStatus
}

export type LastSyncStatus = {
  capturedSessionId?: string
  error?: string
  messageCount?: number
  status: "accepted" | "failed"
  syncedAt: string
}

export type AutomaticSyncFingerprints = Record<string, string>

export type PairCaptureClientInput = {
  apiBaseUrl: string
  apiToken: string
  label: string
}

const STORAGE_KEYS = [
  "apiBaseUrl",
  "autoSyncEnabled",
  "autoSyncFingerprints",
  "captureToken",
  "client",
  "lastSync",
]

export function createMemoryStorageArea(initial: Record<string, unknown> = {}) {
  const state = new Map(Object.entries(initial))
  const area: ExtensionStorageArea & { dump: () => Record<string, unknown> } = {
    dump: () => Object.fromEntries(state.entries()),
    get: async (keys) => {
      if (!keys) return area.dump()
      if (typeof keys === "string") return { [keys]: state.get(keys) }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, state.get(key)]))
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [key, state.get(key) ?? fallback]),
      )
    },
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        state.delete(key)
      }
    },
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) {
        state.set(key, value)
      }
    },
  }
  return area
}

export function chromeStorageArea(area: chrome.storage.StorageArea): ExtensionStorageArea {
  return {
    get: (keys) => area.get(keys ?? null),
    remove: (keys) => area.remove(keys),
    set: (items) => area.set(items),
  }
}

export async function getExtensionConfig(
  storage: ExtensionStorageArea,
): Promise<ExtensionConfig | null> {
  const values = await storage.get(STORAGE_KEYS)
  if (typeof values.apiBaseUrl !== "string" || typeof values.captureToken !== "string") {
    return null
  }
  return {
    apiBaseUrl: values.apiBaseUrl,
    autoSyncEnabled: typeof values.autoSyncEnabled === "boolean" ? values.autoSyncEnabled : true,
    captureToken: values.captureToken,
    ...(isCaptureClient(values.client) ? { client: values.client } : {}),
    ...(isLastSyncStatus(values.lastSync) ? { lastSync: values.lastSync } : {}),
  }
}

export async function saveCaptureTokenConfig(
  storage: ExtensionStorageArea,
  input: { apiBaseUrl: string; captureToken: string; client?: CaptureClientDto },
) {
  await storage.set({
    apiBaseUrl: normalizeApiBaseUrl(input.apiBaseUrl),
    autoSyncEnabled: true,
    captureToken: input.captureToken,
    ...(input.client ? { client: input.client } : {}),
  })
}

export async function saveLastSyncStatus(storage: ExtensionStorageArea, lastSync: LastSyncStatus) {
  await storage.set({ lastSync })
}

export async function saveAutoSyncEnabled(storage: ExtensionStorageArea, autoSyncEnabled: boolean) {
  await storage.set({ autoSyncEnabled })
}

export async function getAcceptedAutoSyncFingerprint(
  storage: ExtensionStorageArea,
  key: string,
): Promise<string | undefined> {
  const values = await storage.get(["autoSyncFingerprints"])
  const fingerprints = isStringRecord(values.autoSyncFingerprints)
    ? values.autoSyncFingerprints
    : {}
  return fingerprints[key]
}

export async function saveAcceptedAutoSyncFingerprint(
  storage: ExtensionStorageArea,
  key: string,
  fingerprint: string,
) {
  const values = await storage.get(["autoSyncFingerprints"])
  const fingerprints = isStringRecord(values.autoSyncFingerprints)
    ? values.autoSyncFingerprints
    : {}
  await storage.set({
    autoSyncFingerprints: {
      ...fingerprints,
      [key]: fingerprint,
    },
  })
}

export async function clearExtensionConfig(storage: ExtensionStorageArea) {
  await storage.remove(STORAGE_KEYS)
}

export async function pairCaptureClient(
  storage: ExtensionStorageArea,
  input: PairCaptureClientInput,
  fetchFn: typeof fetch = fetch,
) {
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl)
  const response = await fetchFn(new URL("/api/v1/session-capture/clients", apiBaseUrl), {
    body: JSON.stringify({ label: input.label }),
    headers: {
      authorization: `Bearer ${input.apiToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  })
  const body = (await response.json()) as CaptureClientPairResponse
  if (!response.ok || body.ok !== true) {
    throw new Error("Failed to pair capture client")
  }

  await saveCaptureTokenConfig(storage, {
    apiBaseUrl,
    captureToken: body.data.rawToken,
    client: body.data.client,
  })

  return {
    apiBaseUrl,
    captureToken: body.data.rawToken,
    client: body.data.client,
  }
}

export function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function isCaptureClient(value: unknown): value is CaptureClientDto {
  return typeof value === "object" && value !== null && "id" in value && "workspaceId" in value
}

function isLastSyncStatus(value: unknown): value is LastSyncStatus {
  return typeof value === "object" && value !== null && "status" in value && "syncedAt" in value
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((item) => typeof item === "string")
  )
}

export type SyncResponseBody = SessionCaptureManualSyncResponse
