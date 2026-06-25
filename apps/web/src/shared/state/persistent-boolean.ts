import { useCallback, useEffect, useState } from "react"

export type PersistentBooleanAdapter = {
  read: (key: string) => boolean | null
  write: (key: string, value: boolean) => void
}

export const localStorageBooleanAdapter: PersistentBooleanAdapter = {
  read: (key) => {
    const storage = getLocalStorage()
    if (!storage) return null

    try {
      const value = storage.getItem(key)
      if (value === "true") return true
      if (value === "false") return false
      return null
    } catch {
      return null
    }
  },
  write: (key, value) => {
    const storage = getLocalStorage()
    if (!storage) return

    try {
      storage.setItem(key, String(value))
    } catch {
      // Treat localStorage failures as unavailable storage.
    }
  },
}

export function usePersistentBoolean({
  adapter,
  defaultValue,
  key,
}: {
  adapter: PersistentBooleanAdapter
  defaultValue: boolean
  key: string
}) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const persisted = adapter.read(key)
    if (persisted !== null) setValue(persisted)
  }, [adapter, key])

  const setPersistentValue = useCallback(
    (nextValue: boolean) => {
      setValue(nextValue)
      adapter.write(key, nextValue)
    },
    [adapter, key],
  )

  return [value, setPersistentValue] as const
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}
