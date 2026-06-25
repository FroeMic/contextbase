declare namespace chrome {
  namespace runtime {
    type ManifestV3 = {
      action: {
        default_popup: string
        default_title?: string
      }
      background: {
        service_worker: string
        type?: "module"
      }
      content_scripts: Array<{
        js: string[]
        matches: string[]
      }>
      description?: string
      host_permissions?: string[]
      manifest_version: 3
      name: string
      permissions?: string[]
      version: string
    }

    const onMessage: {
      addListener: (
        callback: (
          message: never,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | undefined,
      ) => void
    }

    function sendMessage(message: unknown): Promise<unknown>
  }

  namespace storage {
    type StorageArea = {
      get(
        keys?: string | string[] | Record<string, unknown> | null,
      ): Promise<Record<string, unknown>>
      remove(keys: string | string[]): Promise<void>
      set(items: Record<string, unknown>): Promise<void>
    }

    const local: StorageArea
  }

  namespace tabs {
    type Tab = {
      id?: number
      url?: string
    }

    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>
    function sendMessage(tabId: number, message: unknown): Promise<unknown>
  }
}

declare const chrome: {
  runtime: typeof chrome.runtime
  storage: typeof chrome.storage
  tabs: typeof chrome.tabs
}
