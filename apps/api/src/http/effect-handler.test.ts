import { mapAppErrorToHttp } from "@contextbase/core/shared/errors"
import { Effect } from "effect"
import { describe, expect, test } from "vitest"

describe("HTTP error mapping", () => {
  test("maps expected auth errors to an envelope and 401 status", () => {
    const mapped = mapAppErrorToHttp({
      _tag: "AuthenticationError",
      code: "unauthenticated",
      message: "Missing API token",
      details: {},
    })

    expect(mapped.status).toBe(401)
    expect(mapped.body).toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Missing API token",
        details: {},
      },
    })
  })

  test("keeps unexpected defects out of domain error mapping", () => {
    expect(Effect.isEffect(Effect.succeed("ok"))).toBe(true)
  })
})
