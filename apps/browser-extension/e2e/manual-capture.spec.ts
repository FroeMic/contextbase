import { mkdtemp, rm } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { type BrowserContext, chromium, expect, test } from "@playwright/test"

test.describe("manual capture extension flow", () => {
  test("loads the built extension and captures a fixture ChatGPT session", async () => {
    const extensionPath = resolve(import.meta.dirname, "../dist")
    const userDataDir = await mkdtemp(resolve(tmpdir(), "contextbase-extension-e2e-"))
    let context: BrowserContext | undefined
    let server: Server | undefined
    const syncRequests: unknown[] = []

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
        headless: false,
      })
    } catch (error) {
      await rm(userDataDir, { force: true, recursive: true })
      test.skip(
        true,
        `Chromium extension runtime is unavailable in this environment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return
    }

    try {
      const serviceWorker =
        context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
      const extensionId = new URL(serviceWorker.url()).host
      server = await startFakeContextbaseApi(syncRequests)
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Fake API did not bind")
      const apiBaseUrl = `http://127.0.0.1:${address.port}`

      await context.route("https://chatgpt.com/c/e2e-fixture", (route) =>
        route.fulfill({
          body: `
            <!doctype html>
            <html>
              <head><title>Ignored Browser Title</title></head>
              <body>
                <main>
                  <h1>E2E Fixture Session</h1>
                  <article data-testid="conversation-turn-1">
                    <div data-message-author-role="user" data-message-id="msg-user-e2e">
                      Hello from the E2E fixture
                    </div>
                  </article>
                  <article data-testid="conversation-turn-2">
                    <div data-message-author-role="assistant" data-message-id="msg-assistant-e2e">
                      Captured by the extension
                    </div>
                  </article>
                </main>
              </body>
            </html>
          `,
          contentType: "text/html",
        }),
      )

      await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
          captureToken: "cbc_e2e_capture",
        })
      })
      await serviceWorker.evaluate(async (baseUrl) => {
        await chrome.storage.local.set({ apiBaseUrl: baseUrl })
      }, apiBaseUrl)

      const page = await context.newPage()
      await page.goto("https://chatgpt.com/c/e2e-fixture")
      await expect(page.getByText("Hello from the E2E fixture")).toBeVisible()
      await page.bringToFront()
      const tabId = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: "https://chatgpt.com/c/e2e-fixture" })
        return tab?.id
      })
      expect(tabId).toEqual(expect.any(Number))

      const extensionPage = await context.newPage()
      await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`)
      const result = await extensionPage.evaluate(
        async (targetTabId) =>
          Promise.race([
            chrome.runtime.sendMessage({
              tabId: targetTabId,
              type: "contextbase.captureActiveTab",
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("capture response timed out")), 5_000),
            ),
          ]),
        tabId,
      )

      expect(result).toEqual({
        capturedSessionId: "cps_e2e",
        messageCount: 2,
        ok: true,
        status: "accepted",
      })
      expect(syncRequests).toHaveLength(1)
      expect(syncRequests[0]).toMatchObject({
        messages: [
          {
            contentText: "Hello from the E2E fixture",
            role: "user",
            sequenceNumber: "000001",
            sourceMessageId: "msg-user-e2e",
          },
          {
            contentText: "Captured by the extension",
            role: "assistant",
            sequenceNumber: "000002",
            sourceMessageId: "msg-assistant-e2e",
          },
        ],
        provider: { providerKey: "chatgpt" },
        session: {
          sourceSessionId: "e2e-fixture",
          sourceUrl: "https://chatgpt.com/c/e2e-fixture",
          title: "E2E Fixture Session",
        },
      })

      const lastSync = await serviceWorker.evaluate(async () => {
        const values = await chrome.storage.local.get(["lastSync"])
        return values.lastSync
      })
      expect(lastSync).toMatchObject({
        capturedSessionId: "cps_e2e",
        messageCount: 2,
        status: "accepted",
      })
    } finally {
      if (server) {
        const activeServer = server
        await new Promise<void>((resolveClose) => activeServer.close(() => resolveClose()))
      }
      await context?.close()
      await rm(userDataDir, { force: true, recursive: true })
    }
  })

  test("automatically syncs an opened ChatGPT session and scroll-discovered history", async () => {
    const extensionPath = resolve(import.meta.dirname, "../dist")
    const userDataDir = await mkdtemp(resolve(tmpdir(), "contextbase-extension-e2e-"))
    let context: BrowserContext | undefined
    let server: Server | undefined
    const syncRequests: unknown[] = []

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
        headless: false,
      })
    } catch (error) {
      await rm(userDataDir, { force: true, recursive: true })
      test.skip(
        true,
        `Chromium extension runtime is unavailable in this environment: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return
    }

    try {
      const serviceWorker =
        context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
      server = await startFakeContextbaseApi(syncRequests)
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Fake API did not bind")
      const apiBaseUrl = `http://127.0.0.1:${address.port}`

      await serviceWorker.evaluate(async (baseUrl) => {
        await chrome.storage.local.set({
          apiBaseUrl: baseUrl,
          autoSyncEnabled: true,
          captureToken: "cbc_e2e_capture",
        })
      }, apiBaseUrl)

      await context.route("https://chatgpt.com/c/auto-fixture", (route) =>
        route.fulfill({
          body: `
            <!doctype html>
            <html>
              <head><title>Ignored Browser Title</title></head>
              <body style="margin:0">
                <main style="min-height: 2400px; padding-top: 1200px">
                  <h1>Automatic Fixture Session</h1>
                  <div id="history"></div>
                  <article data-testid="conversation-turn-2">
                    <div data-message-author-role="assistant" data-message-id="msg-latest-auto">
                      Latest visible response
                    </div>
                  </article>
                </main>
                <script>
                  window.scrollTo(0, document.documentElement.scrollHeight)
                  window.addEventListener("scroll", () => {
                    if (window.scrollY > 16 || document.getElementById("older-turn")) return
                    const article = document.createElement("article")
                    article.id = "older-turn"
                    article.setAttribute("data-testid", "conversation-turn-1")
                    article.innerHTML = '<div data-message-author-role="user" data-message-id="msg-older-auto">Older prompt revealed by scroll</div>'
                    document.getElementById("history").prepend(article)
                  })
                </script>
              </body>
            </html>
          `,
          contentType: "text/html",
        }),
      )

      const page = await context.newPage()
      await page.goto("https://chatgpt.com/c/auto-fixture")
      await expect(page.getByText("Latest visible response")).toBeVisible()

      await expect.poll(() => syncRequests.length, { timeout: 8_000 }).toBeGreaterThanOrEqual(1)
      expect(syncRequests.at(-1)).toMatchObject({
        observation: {
          latestBoundarySeen: true,
          observationReason: expect.any(String),
          syncMode: "automatic",
        },
        messages: [
          {
            contentText: "Latest visible response",
            sourceMessageId: "msg-latest-auto",
          },
        ],
      })

      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(page.getByText("Older prompt revealed by scroll")).toBeVisible()
      await expect
        .poll(
          () =>
            syncRequests.some((request) =>
              JSON.stringify(request).includes("Older prompt revealed by scroll"),
            ),
          { timeout: 8_000 },
        )
        .toBe(true)
      expect(
        syncRequests.some(
          (request) =>
            (request as { observation?: { oldestBoundarySeen?: boolean } }).observation
              ?.oldestBoundarySeen,
        ),
      ).toBe(true)

      const observedMessageIds = new Set(
        syncRequests
          .flatMap((request) =>
            Array.isArray((request as { messages?: unknown[] }).messages)
              ? ((request as { messages: Array<{ sourceMessageId?: string }> }).messages ?? [])
              : [],
          )
          .map((message) => message.sourceMessageId)
          .filter(Boolean),
      )
      expect(observedMessageIds).toEqual(new Set(["msg-latest-auto", "msg-older-auto"]))
    } finally {
      if (server) {
        const activeServer = server
        await new Promise<void>((resolveClose) => activeServer.close(() => resolveClose()))
      }
      await context?.close()
      await rm(userDataDir, { force: true, recursive: true })
    }
  })
})

async function startFakeContextbaseApi(syncRequests: unknown[]) {
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/api/v1/session-capture/sync/manual") {
      response.writeHead(404).end()
      return
    }
    if (request.headers.authorization !== "Bearer cbc_e2e_capture") {
      response.writeHead(401).end()
      return
    }

    let body = ""
    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      const parsedBody = JSON.parse(body) as { messages?: unknown[] }
      syncRequests.push(parsedBody)
      response.writeHead(200, { "content-type": "application/json" })
      response.end(
        JSON.stringify({
          data: {
            artifactCount: 0,
            capturedSessionId: "cps_e2e",
            messageCount: parsedBody.messages?.length ?? 0,
            syncBatchId: "scb_e2e",
            syncStatus: "accepted",
          },
          ok: true,
        }),
      )
    })
  })

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen))
  return server
}
