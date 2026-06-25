import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"

import {
  chromeStorageArea,
  clearExtensionConfig,
  type ExtensionConfig,
  getExtensionConfig,
  pairCaptureClient,
  saveCaptureTokenConfig,
} from "../../src/storage"
import "./popup.css"

const CAPTURE_ACTIVE_TAB = "contextbase.captureActiveTab"

type CaptureResponse = {
  error?: string
  messageCount?: number
  ok?: boolean
}

type SetupMode = "pair" | "existing"

function PopupApp() {
  const storage = useMemo(() => chromeStorageArea(chrome.storage.local), [])
  const [apiBaseUrl, setApiBaseUrl] = useState("http://127.0.0.1:3517")
  const [apiToken, setApiToken] = useState("")
  const [captureToken, setCaptureToken] = useState("")
  const [config, setConfig] = useState<ExtensionConfig | null>(null)
  const [setupMode, setSetupMode] = useState<SetupMode>("pair")
  const [status, setStatus] = useState("Configure Contextbase to enable capture.")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void refreshConfig(storage, setConfig, setApiBaseUrl, setStatus)
  }, [storage])

  async function run(message: string, action: () => Promise<string>) {
    setBusy(true)
    setStatus(message)
    try {
      setStatus(await action())
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="popup-shell">
      <header>
        <h1>Contextbase</h1>
        <p>{config ? "Connection Ready" : "Set up capture for this browser."}</p>
      </header>

      {config ? (
        <>
          <section className="connection-summary" aria-label="Stored connection">
            <span>API</span>
            <strong>{config.apiBaseUrl}</strong>
            <span>Token</span>
            <strong>{config.captureToken.slice(0, 4)}...stored</strong>
          </section>

          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void run("Capturing current tab...", async () => {
                  const result = (await chrome.runtime.sendMessage({
                    type: CAPTURE_ACTIVE_TAB,
                  })) as CaptureResponse | undefined
                  if (!result?.ok) throw new Error(result?.error ?? "Capture failed")
                  await refreshConfig(storage, setConfig, setApiBaseUrl, setStatus)
                  return `Captured ${result.messageCount ?? 0} messages.`
                })
              }
              type="button"
            >
              Capture Current Session
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run("Clearing configuration...", async () => {
                  await clearExtensionConfig(storage)
                  setConfig(null)
                  setApiToken("")
                  setCaptureToken("")
                  return "Configuration cleared."
                })
              }
              type="button"
            >
              Clear
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            <span>API base URL</span>
            <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} />
          </label>

          <div className="setup-mode" role="tablist" aria-label="Setup method">
            <button
              aria-selected={setupMode === "pair"}
              className={setupMode === "pair" ? "selected" : ""}
              onClick={() => setSetupMode("pair")}
              role="tab"
              type="button"
            >
              Pair with API token
            </button>
            <button
              aria-selected={setupMode === "existing"}
              className={setupMode === "existing" ? "selected" : ""}
              onClick={() => setSetupMode("existing")}
              role="tab"
              type="button"
            >
              Use existing capture token
            </button>
          </div>

          {setupMode === "pair" ? (
            <label>
              <span>Contextbase API token</span>
              <input
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder="cbt_..."
                type="password"
              />
            </label>
          ) : (
            <label>
              <span>Capture token</span>
              <input
                value={captureToken}
                onChange={(event) => setCaptureToken(event.target.value)}
                placeholder="cbc_..."
                type="password"
              />
            </label>
          )}

          <button
            disabled={
              busy ||
              apiBaseUrl.trim() === "" ||
              (setupMode === "pair" ? apiToken.trim() === "" : captureToken.trim() === "")
            }
            onClick={() =>
              void run("Completing setup...", async () => {
                if (setupMode === "pair") {
                  await pairCaptureClient(storage, {
                    apiBaseUrl,
                    apiToken,
                    label: "Contextbase Browser Extension",
                  })
                  setApiToken("")
                  await refreshConfig(storage, setConfig, setApiBaseUrl, setStatus)
                  return "Paired. Capture token stored."
                }

                await saveCaptureTokenConfig(storage, { apiBaseUrl, captureToken })
                setCaptureToken("")
                await refreshConfig(storage, setConfig, setApiBaseUrl, setStatus)
                return "Capture token stored."
              })
            }
            type="button"
          >
            Complete Setup
          </button>
        </>
      )}

      <output className="status">{status}</output>
    </main>
  )
}

async function refreshConfig(
  storage: ReturnType<typeof chromeStorageArea>,
  setConfig: (config: ExtensionConfig | null) => void,
  setApiBaseUrl: (apiBaseUrl: string) => void,
  setStatus: (status: string) => void,
) {
  const nextConfig = await getExtensionConfig(storage)
  setConfig(nextConfig)
  if (nextConfig) {
    setApiBaseUrl(nextConfig.apiBaseUrl)
    setStatus(
      `Connected to ${nextConfig.apiBaseUrl}${
        nextConfig.lastSync ? `; last sync ${nextConfig.lastSync.status}` : ""
      }`,
    )
  }
}

const root = document.getElementById("root")
if (!root) throw new Error("Missing popup root")

createRoot(root).render(<PopupApp />)
