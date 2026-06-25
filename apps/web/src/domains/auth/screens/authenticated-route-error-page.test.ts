import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { AuthApiError } from "../client/auth-api"
import { getAuthenticatedRouteErrorCopy } from "./AuthenticatedRouteErrorPage"

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("authenticated route error page", () => {
  test("turns unauthenticated deep links into a login-required surface", () => {
    expect(
      getAuthenticatedRouteErrorCopy(
        new AuthApiError({
          code: "unauthenticated",
          message: "Missing browser session.",
          status: 401,
        }),
      ),
    ).toMatchObject({
      description:
        "This link may be valid, but Contextbase needs your session before it can open workspace content.",
      eyebrow: "Login required",
      title: "Sign in to open this link",
    })
  })

  test("uses Contextbase product copy and no copied Vertical logo", () => {
    const pageSource = source("src/domains/auth/screens/AuthenticatedRouteErrorPage.tsx")
    const rootSource = source("src/routes/__root.tsx")

    expect(pageSource).toContain("Contextbase")
    expect(pageSource).not.toContain("Vertical")
    expect(pageSource).not.toContain("vertical-logo")
    expect(rootSource).toContain('title: "Contextbase"')
    expect(rootSource).not.toContain("Vertical")
    expect(rootSource).not.toContain("vertical-logo")
  })

  test("keeps cross-workspace links explicit instead of showing a raw loader error", () => {
    expect(
      getAuthenticatedRouteErrorCopy(
        new Error("Workspace switch required", {
          cause: {
            reason: "switch",
          },
        }),
      ),
    ).toMatchObject({
      eyebrow: "404",
      title: "We could not open that link",
    })

    expect(
      getAuthenticatedRouteErrorCopy({
        reason: "switch",
      }),
    ).toMatchObject({
      eyebrow: "Workspace switch required",
      title: "Open this link from the right workspace",
    })
  })

  test("falls back to a friendly 404 with sign-in guidance", () => {
    expect(getAuthenticatedRouteErrorCopy(new Error("Not found"))).toMatchObject({
      eyebrow: "404",
      title: "We could not open that link",
    })
  })
})
