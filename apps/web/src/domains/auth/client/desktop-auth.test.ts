import { describe, expect, test } from "vitest"

import {
  buildDesktopMagicLinkHandoffUrl,
  desktopMagicLinkVerifyUrl,
  detectMagicLinkClientKind,
} from "./desktop-auth"

describe("desktop auth helpers", () => {
  test("detects desktop magic-link requests from the Electron preload API", async () => {
    await expect(
      detectMagicLinkClientKind({
        verticalDesktop: {
          getCapabilities: async () => ({ desktopShell: true, localRunner: false }),
        },
      }),
    ).resolves.toBe("desktop")
  })

  test("falls back to browser magic-link requests without the preload API", async () => {
    await expect(detectMagicLinkClientKind({})).resolves.toBe("browser")
  })

  test("builds the hosted verification URL and desktop protocol handoff", () => {
    const verifyUrl = desktopMagicLinkVerifyUrl(
      "https://contextbase.localhost/auth/desktop/verify?token=raw_magic&redirect_to=%2Facme%2Ftasks",
    )

    expect(verifyUrl).toBe(
      "https://contextbase.localhost/auth/verify?token=raw_magic&redirect_to=%2Facme%2Ftasks",
    )
    expect(buildDesktopMagicLinkHandoffUrl(verifyUrl)).toBe(
      "contextbase://open?url=https%3A%2F%2Fcontextbase.localhost%2Fauth%2Fverify%3Ftoken%3Draw_magic%26redirect_to%3D%252Facme%252Ftasks",
    )
  })
})
