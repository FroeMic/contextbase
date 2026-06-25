export type PageHintStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

export const localStoragePageHintStorage: PageHintStorage = {
  getItem: (key) => getLocalStorage()?.getItem(key) ?? null,
  setItem: (key, value) => {
    getLocalStorage()?.setItem(key, value)
  },
  removeItem: (key) => {
    getLocalStorage()?.removeItem(key)
  },
}

export function pageHintDismissedStorageKey(namespace: string) {
  return `contextbase:page-hints:${namespace}:dismissed`
}

export function readDismissedPageHintKeys(storage: PageHintStorage, namespace: string) {
  try {
    const parsed = JSON.parse(storage.getItem(pageHintDismissedStorageKey(namespace)) ?? "[]") as
      | unknown[]
      | null

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [],
    )
  } catch {
    return new Set<string>()
  }
}

export function dismissPageHintKey(storage: PageHintStorage, namespace: string, hintKey: string) {
  try {
    const dismissed = readDismissedPageHintKeys(storage, namespace)
    dismissed.add(hintKey)
    storage.setItem(pageHintDismissedStorageKey(namespace), JSON.stringify([...dismissed]))
  } catch {
    // Treat localStorage failures as unavailable storage.
  }
}

export function clearDismissedPageHintKeys(storage: PageHintStorage, namespace: string) {
  try {
    storage.removeItem(pageHintDismissedStorageKey(namespace))
  } catch {
    // Treat localStorage failures as unavailable storage.
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}
