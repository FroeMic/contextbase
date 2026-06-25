import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import {
  createOAuthAccessToken,
  createOAuthAuthorizationCode,
  createOAuthRefreshToken,
  hashOAuthToken,
  normalizeOAuthScopes,
  validateOAuthAuthorizationRequest,
  verifyOAuthToken,
  verifyPkceChallenge,
} from "./service"

describe("OAuth service", () => {
  test("normalizes known scopes and rejects unknown scopes", async () => {
    await expect(
      Effect.runPromise(
        normalizeOAuthScopes([
          "contextbase:write",
          "contextbase:read",
          "contextbase:manage",
          "contextbase:write",
          "offline_access",
        ]),
      ),
    ).resolves.toEqual([
      "contextbase:read",
      "contextbase:write",
      "contextbase:manage",
      "offline_access",
    ])

    await expect(
      Effect.runPromise(
        Effect.flip(normalizeOAuthScopes(["contextbase:read", "contextbase:unknown"])),
      ),
    ).resolves.toMatchObject({
      _tag: "InvalidRequestError",
      code: "invalid_request",
    })
  })

  test("validates authorization requests for PKCE and resource audience", async () => {
    await expect(
      Effect.runPromise(
        validateOAuthAuthorizationRequest(
          {
            clientId: "https://client.example/.well-known/oauth-client",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
            redirectUri: "http://127.0.0.1:49152/callback",
            resource: "http://127.0.0.1:3217/mcp",
            responseType: "code",
            scopes: ["contextbase:read", "contextbase:files"],
            state: "state_123",
          },
          {
            allowedResources: ["http://127.0.0.1:3217/mcp"],
          },
        ),
      ),
    ).resolves.toMatchObject({
      resource: "http://127.0.0.1:3217/mcp",
      scopes: ["contextbase:read", "contextbase:files"],
    })

    await expect(
      Effect.runPromise(
        Effect.flip(
          validateOAuthAuthorizationRequest(
            {
              clientId: "client",
              codeChallenge: "challenge",
              codeChallengeMethod: "plain",
              redirectUri: "http://127.0.0.1:49152/callback",
              resource: "http://127.0.0.1:3217/mcp",
              responseType: "code",
              scopes: ["contextbase:read"],
              state: "state_123",
            },
            {
              allowedResources: ["http://127.0.0.1:3217/mcp"],
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "InvalidRequestError",
      code: "invalid_request",
    })
  })

  test("accepts HTTPS and rejects non-loopback plain HTTP redirect URIs", async () => {
    await expect(
      Effect.runPromise(
        validateOAuthAuthorizationRequest(
          {
            clientId: "https://client.example/.well-known/oauth-client",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
            redirectUri: "https://client.example/callback",
            resource: "http://127.0.0.1:3217/mcp",
            responseType: "code",
            scopes: ["contextbase:read"],
            state: "state_123",
          },
          {
            allowedResources: ["http://127.0.0.1:3217/mcp"],
          },
        ),
      ),
    ).resolves.toMatchObject({
      redirectUri: "https://client.example/callback",
    })

    await expect(
      Effect.runPromise(
        Effect.flip(
          validateOAuthAuthorizationRequest(
            {
              clientId: "https://claude.ai/oauth/claude-code-client-metadata",
              codeChallenge: "challenge",
              codeChallengeMethod: "S256",
              redirectUri: "http://attacker.example/callback",
              resource: "http://127.0.0.1:3217/mcp",
              responseType: "code",
              scopes: ["contextbase:read"],
              state: "state_123",
            },
            {
              allowedResources: ["http://127.0.0.1:3217/mcp"],
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "InvalidRequestError",
      code: "invalid_request",
      details: {
        redirectUri: "http://attacker.example/callback",
      },
    })
  })

  test("accepts Cursor native OAuth callback redirect URI", async () => {
    await expect(
      Effect.runPromise(
        validateOAuthAuthorizationRequest(
          {
            clientId: "dcr_cursor",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
            redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
            resource: "http://127.0.0.1:3217/mcp",
            responseType: "code",
            scopes: ["contextbase:read"],
            state: "state_123",
          },
          {
            allowedResources: ["http://127.0.0.1:3217/mcp"],
          },
        ),
      ),
    ).resolves.toMatchObject({
      redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
    })
  })

  test("creates opaque OAuth tokens and verifies only their hashes", () => {
    const authorizationCode = createOAuthAuthorizationCode()
    const accessToken = createOAuthAccessToken()
    const refreshToken = createOAuthRefreshToken()
    const authorizationCodeHash = hashOAuthToken(authorizationCode)

    expect(authorizationCode).toMatch(/^oa_code_[A-Za-z0-9_-]{43}$/)
    expect(accessToken).toMatch(/^vca_[A-Za-z0-9_-]{43}$/)
    expect(refreshToken).toMatch(/^vcr_[A-Za-z0-9_-]{43}$/)
    expect(authorizationCodeHash).not.toContain(authorizationCode)
    expect(verifyOAuthToken(authorizationCode, authorizationCodeHash)).toBe(true)
    expect(verifyOAuthToken(`${authorizationCode}x`, authorizationCodeHash)).toBe(false)
  })

  test("verifies S256 PKCE challenges", () => {
    const verifier = "test-verifier"
    const challenge = "JBbiqONGWPaAmwXk_8bT6UnlPfrn65D32eZlJS-zGG0"

    expect(verifyPkceChallenge(verifier, challenge)).toBe(true)
    expect(verifyPkceChallenge("wrong-verifier", challenge)).toBe(false)
  })
})
