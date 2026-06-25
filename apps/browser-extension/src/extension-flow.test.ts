import { describe, expect, test } from "vitest"

import { createCaptureFlowController } from "./extension-flow"
import type { ExtractedSession } from "./providers/types"

describe("extension capture flow", () => {
  test("extracts from the active tab and syncs through extension-owned code", async () => {
    const extracted: ExtractedSession = {
      messages: [],
      parserVersion: "chatgpt-dom@0.1.0",
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: { kind: "chat", sourceUrl: "https://chatgpt.com/c/abc" },
    }
    const calls: string[] = []
    const controller = createCaptureFlowController({
      getActiveTab: async () => ({ id: 7, url: "https://chatgpt.com/c/abc" }),
      getConfig: async () => ({
        apiBaseUrl: "http://127.0.0.1:3017",
        captureToken: "vcc_capture",
      }),
      sendTabMessage: async (tabId, message) => {
        calls.push(`content:${tabId}:${message.type}`)
        expect(JSON.stringify(message)).not.toContain("vcc_capture")
        return { extracted }
      },
      syncExtractedSession: async (config, session) => {
        calls.push(`sync:${config.captureToken}:${session.session.sourceUrl}`)
        return { capturedSessionId: "cps_123", messageCount: 0, syncStatus: "accepted" }
      },
    })

    await expect(controller.captureActiveTab()).resolves.toMatchObject({
      capturedSessionId: "cps_123",
      ok: true,
      status: "accepted",
    })
    expect(calls).toEqual([
      "content:7:contextbase.extractCurrentSession",
      "sync:vcc_capture:https://chatgpt.com/c/abc",
    ])
  })

  test("reports missing configuration and unsupported tabs", async () => {
    await expect(
      createCaptureFlowController({
        getActiveTab: async () => ({ id: 1, url: "https://chatgpt.com/c/abc" }),
        getConfig: async () => null,
        sendTabMessage: async () => {
          throw new Error("should not extract without config")
        },
        syncExtractedSession: async () => {
          throw new Error("should not sync without config")
        },
      }).captureActiveTab(),
    ).resolves.toEqual({ error: "Configure Contextbase before capturing.", ok: false })

    await expect(
      createCaptureFlowController({
        getActiveTab: async () => ({ id: 1, url: "https://example.com" }),
        getConfig: async () => ({
          apiBaseUrl: "http://127.0.0.1:3017",
          captureToken: "vcc_capture",
        }),
        sendTabMessage: async () => {
          throw new Error("should not extract unsupported tabs")
        },
        syncExtractedSession: async () => {
          throw new Error("should not sync unsupported tabs")
        },
      }).captureActiveTab(),
    ).resolves.toEqual({ error: "Open a supported ChatGPT conversation tab.", ok: false })
  })
})
