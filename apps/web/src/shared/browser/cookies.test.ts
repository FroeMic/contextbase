import { describe, expect, test } from "vitest"

import { serializeBrowserCookie } from "./cookies"

describe("browser cookie helpers", () => {
  test("serializes encoded cookies with explicit browser security attributes", () => {
    expect(
      serializeBrowserCookie("vertical ui theme", "dark/system", {
        domain: ".startwithvertical.test",
        maxAge: 31_536_000,
        path: "/",
        sameSite: "Lax",
        secure: true,
      }),
    ).toBe(
      "vertical%20ui%20theme=dark%2Fsystem; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.startwithvertical.test; Secure",
    )
  })
})
