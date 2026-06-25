import { describe, expect, test } from "vitest"

import {
  clearAuthShellCookie,
  clearSessionCookie,
  readSessionCookie,
  readSessionCookies,
  serializeAuthShellCookie,
  serializeSessionCookie,
} from "./cookie"

describe("browser session cookie", () => {
  test("serializes an httpOnly secure production session cookie", () => {
    const cookie = serializeSessionCookie("raw_session", {
      domain: ".vertical.example.com",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      secure: true,
    })
    expect(cookie).toContain("contextbase_session=raw_session")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
  })

  test("reads and clears the configured session cookie", () => {
    expect(readSessionCookie("other=x; contextbase_session=abc%20123")).toBe("abc 123")
    const cookie = clearSessionCookie({ secure: true })
    expect(cookie).toContain("contextbase_session=")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
  })

  test("reads duplicate session cookies in header order", () => {
    expect(
      readSessionCookies("contextbase_session=prod; other=x; contextbase_session=staging%20123"),
    ).toEqual(["prod", "staging 123"])
  })

  test("serializes a non-sensitive auth shell presentation cookie", () => {
    const cookie = serializeAuthShellCookie({
      domain: ".vertical.example.com",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      secure: true,
    })

    expect(cookie).toContain("contextbase_auth_shell=1")
    expect(cookie).not.toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(clearAuthShellCookie({ secure: true })).toContain("contextbase_auth_shell=")
  })
})
