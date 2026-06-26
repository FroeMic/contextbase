import { describe, expect, test } from "vitest"

import {
  capturedChatStatusLabel,
  capturedChatTitle,
  capturedMessageText,
  capturedProviderLabel,
  capturedTurnKind,
  compareCapturedMessages,
  dedupeCapturedMessages,
  formatCapturedTimestamp,
} from "./presentation"

describe("captured chats presentation", () => {
  test("formats provider labels and captured session title fallbacks", () => {
    expect(capturedProviderLabel("chatgpt")).toBe("ChatGPT")
    expect(capturedProviderLabel("claude")).toBe("Claude")
    expect(capturedProviderLabel("unknown-provider")).toBe("Assistant")

    expect(
      capturedChatTitle({
        sourceSessionKey: "chatgpt:https://chatgpt.com/c/abc123",
        title: "  ",
      }),
    ).toBe("Untitled captured chat")
    expect(capturedChatTitle({ sourceSessionKey: "key", title: "Build plan" })).toBe("Build plan")
  })

  test("maps captured roles to transcript turn kinds without hiding future roles", () => {
    expect(capturedTurnKind("user")).toBe("current_user")
    expect(capturedTurnKind("assistant")).toBe("assistant")
    expect(capturedTurnKind("system")).toBe("system")
    expect(capturedTurnKind("tool")).toBe("system")
    expect(capturedTurnKind("future_role")).toBe("system")
  })

  test("sorts messages by sequence number and removes repeated source identities", () => {
    const messages = [
      message({ id: "third", sequenceNumber: "0003", sourceMessageKey: "m3" }),
      message({ id: "first", sequenceNumber: "0001", sourceMessageKey: "m1" }),
      message({ id: "first-duplicate", sequenceNumber: "0001", sourceMessageKey: "m1" }),
    ]

    expect([...messages].sort(compareCapturedMessages).map((item) => item.id)).toEqual([
      "first",
      "first-duplicate",
      "third",
    ])
    expect(dedupeCapturedMessages(messages).map((item) => item.id)).toEqual(["first", "third"])
  })

  test("formats content, timestamps, and conservative mirror status", () => {
    expect(capturedMessageText(message({ contentText: "Hello" }))).toBe("Hello")
    expect(
      capturedMessageText(message({ contentJson: JSON.stringify({ text: "From JSON" }) })),
    ).toBe("From JSON")
    expect(formatCapturedTimestamp(Date.UTC(2026, 5, 25, 15, 30))).toBe("17:30")
    expect(capturedChatStatusLabel({ metadataJson: "{}" })).toBe("Partial mirror")
    expect(
      capturedChatStatusLabel({
        metadataJson: JSON.stringify({
          coverage: { latestBoundarySeen: true, oldestBoundarySeen: true },
        }),
      }),
    ).toBe("Complete mirror")
  })
})

function message(overrides: Partial<CapturedMessageFixture> = {}): CapturedMessageFixture {
  return {
    capturedSessionId: "cps_1",
    contentJson: null,
    contentText: null,
    createdAt: Date.UTC(2026, 5, 25, 15, 0),
    id: "cpm_1",
    metadataJson: null,
    providerId: "cpr_1",
    role: "assistant",
    sequenceNumber: "0001",
    sourceCreatedAt: Date.UTC(2026, 5, 25, 15, 0),
    sourceFingerprint: "fp",
    sourceMessageId: null,
    sourceMessageKey: "m1",
    updatedAt: Date.UTC(2026, 5, 25, 15, 0),
    workspaceId: "w_1",
    ...overrides,
  }
}

type CapturedMessageFixture = {
  capturedSessionId: string
  contentJson: string | null
  contentText: string | null
  createdAt: number
  id: string
  metadataJson: string | null
  providerId: string
  role: string | null
  sequenceNumber: string
  sourceCreatedAt: number | null
  sourceFingerprint: string
  sourceMessageId: string | null
  sourceMessageKey: string
  updatedAt: number
  workspaceId: string
}
