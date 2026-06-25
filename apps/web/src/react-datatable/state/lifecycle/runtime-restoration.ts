export interface DatatableRuntimePaginationState {
  pageIndex: number
  pageSize: number
}

export interface DatatableRuntimeScrollState {
  scrollLeft: number
  scrollTop: number
}

type RuntimeScrollBucket = "horizontal" | "vertical" | "default"

export interface DatatableRuntimeRestorationOptions {
  key: string
  pagination: boolean
  scroll: boolean
}

export type DatatableRuntimeRestorationConfig =
  | boolean
  | {
      key?: string
      pagination?: boolean
      scroll?: boolean
    }

interface RuntimeRestorationEntry {
  pagination: Map<string, DatatableRuntimePaginationState>
  scroll: Map<string, DatatableRuntimeScrollState>
}

// Internal behavior flag: keep only the latest scroll restoration per table key.
// Not exposed via Datatable props.
const KEEP_ONLY_LATEST_SCROLL_RESTORATION = true

const PAGINATION_STORAGE_PREFIX = "react-datatable:runtime-pagination:"
const SCROLL_STORAGE_PREFIX = "react-datatable:runtime-scroll:"
const runtimeRestorationStore = new Map<string, RuntimeRestorationEntry>()
const runtimeStorageKeys = new Set<string>()

function getRuntimeRestorationEntry(key: string) {
  let entry = runtimeRestorationStore.get(key)

  if (!entry) {
    entry = {
      pagination: new Map(),
      scroll: new Map(),
    }
    runtimeRestorationStore.set(key, entry)
  }

  return entry
}

export function resolveRuntimeRestorationOptions(
  tableKey: string,
  config: DatatableRuntimeRestorationConfig | undefined,
): DatatableRuntimeRestorationOptions | null {
  if (config === false) {
    return null
  }

  if (config === true || config === undefined) {
    return {
      key: tableKey,
      pagination: true,
      scroll: true,
    }
  }

  return {
    key: config.key ?? tableKey,
    pagination: config.pagination ?? true,
    scroll: config.scroll ?? true,
  }
}

export function getRuntimePaginationState(
  key: string,
  signature: string,
): DatatableRuntimePaginationState | null {
  const storageKey = getRuntimeStorageKey(PAGINATION_STORAGE_PREFIX, key, signature)
  const storedState = readRuntimeStateFromSessionStorage(storageKey, isRuntimePaginationState)

  if (storedState) {
    return storedState
  }

  return getRuntimeRestorationEntry(key).pagination.get(signature) ?? null
}

export function setRuntimePaginationState(
  key: string,
  signature: string,
  state: DatatableRuntimePaginationState,
) {
  getRuntimeRestorationEntry(key).pagination.set(signature, state)
  writeRuntimeStateToSessionStorage(
    getRuntimeStorageKey(PAGINATION_STORAGE_PREFIX, key, signature),
    state,
  )
}

export function getRuntimeScrollState(
  key: string,
  signature: string,
): DatatableRuntimeScrollState | null {
  return getRuntimeScrollStateByBucket(key, signature, "default")
}

export function getRuntimeScrollStateByBucket(
  key: string,
  signature: string,
  bucket: RuntimeScrollBucket,
): DatatableRuntimeScrollState | null {
  const scopedSignature = `[${bucket}]::${signature}`
  const storageKey = getRuntimeStorageKey(SCROLL_STORAGE_PREFIX, key, scopedSignature)
  const storedState = readRuntimeStateFromSessionStorage(storageKey, isRuntimeScrollState)

  if (storedState) {
    return storedState
  }

  return getRuntimeRestorationEntry(key).scroll.get(scopedSignature) ?? null
}

export function setRuntimeScrollState(
  key: string,
  signature: string,
  state: DatatableRuntimeScrollState,
) {
  setRuntimeScrollStateInternal(key, signature, state, "default")
}

export function setRuntimeScrollStateByBucket(
  key: string,
  signature: string,
  state: DatatableRuntimeScrollState,
  bucket: RuntimeScrollBucket,
) {
  setRuntimeScrollStateInternal(key, signature, state, bucket)
}

function setRuntimeScrollStateInternal(
  key: string,
  signature: string,
  state: DatatableRuntimeScrollState,
  bucket: RuntimeScrollBucket,
) {
  const entry = getRuntimeRestorationEntry(key)

  if (KEEP_ONLY_LATEST_SCROLL_RESTORATION) {
    const storage = getSessionStorage()
    const storagePrefix = `${SCROLL_STORAGE_PREFIX}${encodeURIComponent(key)}:`
    const bucketPrefix = `[${bucket}]::`
    const scopedSignature = `${bucketPrefix}${signature}`
    const scopedStorageKey = getRuntimeStorageKey(SCROLL_STORAGE_PREFIX, key, scopedSignature)

    for (const existingSignature of Array.from(entry.scroll.keys())) {
      if (!existingSignature.startsWith(bucketPrefix) || existingSignature === scopedSignature) {
        continue
      }
      entry.scroll.delete(existingSignature)
    }

    if (storage) {
      for (const storageKey of Array.from(runtimeStorageKeys)) {
        if (storageKey.startsWith(storagePrefix) && storageKey !== scopedStorageKey) {
          const encodedBucketPrefix = encodeURIComponent(bucketPrefix)
          if (!storageKey.includes(`:${encodedBucketPrefix}`)) {
            continue
          }
          storage.removeItem(storageKey)
          runtimeStorageKeys.delete(storageKey)
        }
      }
    }

    entry.scroll.set(scopedSignature, state)
    writeRuntimeStateToSessionStorage(scopedStorageKey, state)
    return
  }

  entry.scroll.set(signature, state)
  writeRuntimeStateToSessionStorage(
    getRuntimeStorageKey(SCROLL_STORAGE_PREFIX, key, signature),
    state,
  )
}

export function clearRuntimeRestorationState() {
  runtimeRestorationStore.clear()
  const storage = getSessionStorage()

  if (storage) {
    for (const storageKey of runtimeStorageKeys) {
      storage.removeItem(storageKey)
    }
  }

  runtimeStorageKeys.clear()
}

function getRuntimeStorageKey(prefix: string, key: string, signature: string) {
  return `${prefix}${encodeURIComponent(key)}:${encodeURIComponent(signature)}`
}

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function readRuntimeStateFromSessionStorage<TState>(
  storageKey: string,
  isValidState: (value: unknown) => value is TState,
): TState | null {
  const storage = getSessionStorage()

  if (!storage) {
    return null
  }

  const raw = storage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (isValidState(parsed)) {
      return parsed
    }
  } catch {
    // Invalid session data should not prevent the table from rendering.
  }

  storage.removeItem(storageKey)
  return null
}

function writeRuntimeStateToSessionStorage(
  storageKey: string,
  state: DatatableRuntimePaginationState | DatatableRuntimeScrollState,
) {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(storageKey, JSON.stringify(state))
    runtimeStorageKeys.add(storageKey)
  } catch {
    // Storage can be unavailable or full; the in-memory fallback still works.
  }
}

function isRuntimePaginationState(value: unknown): value is DatatableRuntimePaginationState {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as DatatableRuntimePaginationState).pageIndex === "number" &&
    typeof (value as DatatableRuntimePaginationState).pageSize === "number"
  )
}

function isRuntimeScrollState(value: unknown): value is DatatableRuntimeScrollState {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as DatatableRuntimeScrollState).scrollLeft === "number" &&
    typeof (value as DatatableRuntimeScrollState).scrollTop === "number"
  )
}
