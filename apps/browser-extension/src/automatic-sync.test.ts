import { describe, expect, test } from "vitest"

import {
  AUTOMATIC_SESSION_OBSERVED,
  createAutomaticSyncController,
  withAutomaticObservation,
} from "./automatic-sync"
import type { ExtractedSession } from "./providers/types"

const extracted: ExtractedSession = {
  messages: [
    {
      contentText: "Hello",
      role: "user",
      sequenceNumber: "000001",
      sourceMessageKey: "msg-1",
    },
  ],
  parserVersion: "chatgpt-dom@0.1.0",
  provider: { displayName: "ChatGPT", providerKey: "chatgpt" },
  session: {
    kind: "chat",
    sourceSessionId: "chat-1",
    sourceUrl: "https://chatgpt.com/c/chat-1",
  },
}

describe("automatic sync", () => {
  test("adds observation metadata to extracted sessions", () => {
    expect(withAutomaticObservation(extracted, "initial_load")).toMatchObject({
      observation: {
        latestObservedMessageKey: "msg-1",
        observationReason: "initial_load",
        observedMessageKeys: ["msg-1"],
        syncMode: "automatic",
        visibleMessageCount: 1,
      },
    })
    expect(withAutomaticObservation(extracted, "initial_load").observation).not.toHaveProperty(
      "oldestBoundarySeen",
    )
    expect(withAutomaticObservation(extracted, "initial_load").observation).not.toHaveProperty(
      "latestBoundarySeen",
    )
  })

  test("syncs observed sessions once and skips unchanged observations", async () => {
    const synced: ExtractedSession[] = []
    const statuses: unknown[] = []
    const controller = createAutomaticSyncController({
      getConfig: async () => ({
        apiBaseUrl: "http://127.0.0.1:3017",
        autoSyncEnabled: true,
        captureToken: "cbc_capture",
      }),
      saveLastSyncStatus: async (status) => {
        statuses.push(status)
      },
      syncExtractedSession: async (_config, session) => {
        synced.push(session)
        return {
          capturedSessionId: "cps_123",
          messageCount: 1,
          ok: true,
          syncStatus: "accepted",
        }
      },
    })

    const message = {
      extracted: withAutomaticObservation(extracted, "initial_load"),
      type: AUTOMATIC_SESSION_OBSERVED,
    } as const

    await expect(controller.handleObservedSession(message)).resolves.toEqual({
      ok: true,
      skipped: false,
    })
    await expect(controller.handleObservedSession(message)).resolves.toEqual({
      ok: true,
      skipped: true,
    })

    expect(synced).toHaveLength(1)
    expect(statuses).toHaveLength(1)
  })

  test("uses persisted accepted fingerprints after controller recreation", async () => {
    const fingerprints = new Map<string, string>()
    const syncCalls: ExtractedSession[] = []
    const dependencies = {
      getAcceptedFingerprint: async (key: string) => fingerprints.get(key),
      getConfig: async () => ({
        apiBaseUrl: "http://127.0.0.1:3017",
        autoSyncEnabled: true,
        captureToken: "cbc_capture",
      }),
      saveAcceptedFingerprint: async (key: string, fingerprint: string) => {
        fingerprints.set(key, fingerprint)
      },
      saveLastSyncStatus: async () => undefined,
      syncExtractedSession: async (_config: unknown, session: ExtractedSession) => {
        syncCalls.push(session)
        return {
          capturedSessionId: "cps_123",
          messageCount: 1,
          ok: true as const,
          syncStatus: "accepted" as const,
        }
      },
    }
    const message = {
      extracted: withAutomaticObservation(extracted, "initial_load"),
      type: AUTOMATIC_SESSION_OBSERVED,
    } as const

    await createAutomaticSyncController(dependencies).handleObservedSession(message)
    await createAutomaticSyncController(dependencies).handleObservedSession(message)

    expect(syncCalls).toHaveLength(1)
  })

  test("retries a failed observation on the next matching observation", async () => {
    let calls = 0
    const controller = createAutomaticSyncController({
      getConfig: async () => ({
        apiBaseUrl: "http://127.0.0.1:3017",
        autoSyncEnabled: true,
        captureToken: "cbc_capture",
      }),
      saveLastSyncStatus: async () => undefined,
      syncExtractedSession: async () => {
        calls += 1
        return calls === 1
          ? { error: "Network unavailable", ok: false as const }
          : {
              capturedSessionId: "cps_123",
              messageCount: 1,
              ok: true as const,
              syncStatus: "accepted" as const,
            }
      },
    })
    const message = {
      extracted: withAutomaticObservation(extracted, "initial_load"),
      type: AUTOMATIC_SESSION_OBSERVED,
    } as const

    await expect(controller.handleObservedSession(message)).resolves.toMatchObject({
      ok: false,
    })
    await expect(controller.handleObservedSession(message)).resolves.toEqual({
      ok: true,
      skipped: false,
    })
    await expect(controller.handleObservedSession(message)).resolves.toEqual({
      ok: true,
      skipped: true,
    })

    expect(calls).toBe(2)
  })
})
