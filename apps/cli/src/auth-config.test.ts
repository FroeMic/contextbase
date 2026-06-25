import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

import {
  loadCliAuthConfig,
  resolveConfiguredAccessToken,
  saveCliOAuthCredential,
} from "./auth-config.js"

describe("CLI OAuth config", () => {
  test("stores OAuth credentials and refreshes expired access tokens", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contextbase-cli-auth-"))
    const configPath = join(dir, "config.json")
    const requests: Array<{ body: string; input: string }> = []

    try {
      await saveCliOAuthCredential(
        {
          accessToken: "vca_old",
          apiUrl: "http://127.0.0.1:3017",
          authBaseUrl: "http://127.0.0.1:3317",
          clientId: "contextbase-cli",
          expiresAt: "2026-06-02T11:59:00.000Z",
          refreshToken: "vcr_old",
          resource: "http://127.0.0.1:3017/api/v1",
          scopes: ["contextbase:read", "offline_access"],
        },
        { configPath },
      )

      const token = await resolveConfiguredAccessToken({
        configPath,
        fetch: async (input, init) => {
          requests.push({ body: String(init?.body), input: String(input) })
          return new Response(
            JSON.stringify({
              access_token: "vca_new",
              expires_in: 3600,
              refresh_token: "vcr_new",
              scope: "contextbase:read offline_access",
              token_type: "Bearer",
            }),
          )
        },
        now: new Date("2026-06-02T12:00:00.000Z"),
      })

      expect(token).toBe("vca_new")
      expect(requests[0]?.input).toBe("http://127.0.0.1:3317/oauth/token")
      expect(Object.fromEntries(new URLSearchParams(requests[0]?.body))).toEqual({
        client_id: "contextbase-cli",
        grant_type: "refresh_token",
        refresh_token: "vcr_old",
        resource: "http://127.0.0.1:3017/api/v1",
      })
      await expect(loadCliAuthConfig({ configPath })).resolves.toMatchObject({
        auth: {
          accessToken: "vca_new",
          refreshToken: "vcr_new",
        },
      })
      await expect(readFile(configPath, "utf8")).resolves.toContain("vca_new")
    } finally {
      await rm(dir, { force: true, recursive: true })
    }
  })
})
