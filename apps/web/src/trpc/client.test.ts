import { readFileSync } from "node:fs"
import { join } from "node:path"
import { InvariantViolationError } from "@contextbase/core/shared/errors"
import type { TRPCError } from "@trpc/server"
import { describe, expect, test } from "vitest"

import { createTrpcContext } from "./context"
import { toTrpcError } from "./errors"

describe("tRPC browser client", () => {
  test("provides a typed tRPC client with browser session credentials", () => {
    const reactSource = readFileSync(join(process.cwd(), "src/trpc/react.ts"), "utf8")
    const clientSource = readFileSync(join(process.cwd(), "src/trpc/client.tsx"), "utf8")
    const browserClientSource = readFileSync(
      join(process.cwd(), "src/trpc/browser-client.ts"),
      "utf8",
    )
    const providersSource = readFileSync(
      join(process.cwd(), "src/app/providers/AppProviders.tsx"),
      "utf8",
    )

    expect(reactSource).toContain("createTRPCReact")
    expect(reactSource).toContain("import type")
    expect(reactSource).toContain("AppRouter")
    expect(browserClientSource).toContain("httpBatchLink")
    expect(browserClientSource).toContain('url: "/api/trpc"')
    expect(browserClientSource).toContain('credentials: "include"')
    expect(clientSource).toContain("createBrowserTrpcClient")
    expect(providersSource).toContain("TrpcProvider")
  })

  test("maps missing browser sessions during context creation to a tRPC unauthorized error", async () => {
    await expect(
      createTrpcContext({
        req: new Request("https://vertical.example.com/api/trpc/tasks.update"),
      } as Parameters<typeof createTrpcContext>[0]),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ _tag: "AuthenticationError" }),
      code: "UNAUTHORIZED",
      message: "Browser session is required.",
    })
  })

  test("does not mask unexpected server errors as missing browser sessions", () => {
    expect(toTrpcError(new Error("database unavailable"))).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
    } satisfies Partial<TRPCError>)
  })

  test("surfaces domain error messages through tRPC mapping", () => {
    const error = new InvariantViolationError({
      code: "invariant_violation",
      details: {},
      message: "Task monitor requires an agent assignee",
    })

    expect(toTrpcError(error)).toMatchObject({
      code: "BAD_REQUEST",
      message: "Task monitor requires an agent assignee",
    } satisfies Partial<TRPCError>)
  })
})
