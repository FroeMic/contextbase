import { describe, expect, test } from "vitest"

import { EXTRACT_CURRENT_SESSION } from "../extension-flow"
import type { ExtractedSession } from "../providers/types"
import { sendTabMessageWithContentScriptRecovery } from "./manual-capture-messaging"

describe("manual capture messaging", () => {
  test("injects the ChatGPT content script and retries when the receiving end is missing", async () => {
    const calls: string[] = []
    const extracted: ExtractedSession = {
      messages: [],
      parserVersion: "chatgpt-dom@0.1.0",
      provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
      session: { kind: "chat", sourceUrl: "https://chatgpt.com/c/abc" },
    }

    const result = await sendTabMessageWithContentScriptRecovery(
      {
        executeScript: async (details) => {
          calls.push(`inject:${details.target.tabId}:${details.files.join(",")}`)
        },
        sendMessage: async (tabId, message) => {
          calls.push(`send:${tabId}:${message.type}`)
          if (calls.length === 1) {
            throw new Error("Could not establish connection. Receiving end does not exist.")
          }
          return { extracted }
        },
      },
      7,
      { type: EXTRACT_CURRENT_SESSION },
    )

    expect(result).toEqual({ extracted })
    expect(calls).toEqual([
      "send:7:contextbase.extractCurrentSession",
      "inject:7:content-scripts/chatgpt.js",
      "send:7:contextbase.extractCurrentSession",
    ])
  })
})
