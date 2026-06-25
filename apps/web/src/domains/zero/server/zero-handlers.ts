import { createDbClient } from "@contextbase/core/db/client"
import {
  type BrowserSessionContext,
  validateBrowserSession,
} from "@contextbase/core/domains/auth/browser-session"
import { createPostgresBrowserAuthStore } from "@contextbase/core/domains/auth/browser-session-repository"
import { mapAppErrorToHttp } from "@contextbase/core/shared/errors"
import { queries, schema, type ZeroAuthContext } from "@contextbase/zero-schema"
import { getQuery, type ReadonlyJSONValue } from "@rocicorp/zero"
import { ApplicationError, handleQueryRequest } from "@rocicorp/zero/server"
import { Effect } from "effect"

import { readSessionCookies } from "../../auth/server/cookie"

export type ZeroHandlerDependencies = {
  validateSession?: typeof validateSessionDependency
}

export function buildZeroContextFromSession(session: BrowserSessionContext): ZeroAuthContext {
  return {
    activeWorkspaceId: session.activeWorkspaceId,
    activeWorkspaceRole: session.activeWorkspaceRole,
    activeWorkspaceSlug: session.activeWorkspaceSlug,
    capabilities: ["contextbase:read"],
    userId: session.userId,
  }
}

export function transformZeroQuery(
  name: string,
  args: ReadonlyJSONValue | undefined,
  context: ZeroAuthContext,
) {
  const query = getQuery(queries, name)
  if (!query) {
    throw new ApplicationError("Unknown Zero query", {
      details: { name },
    })
  }

  return query.fn({ args: args as never, ctx: context })
}

export async function handleZeroQueryRequest(
  request: Request,
  dependencies: ZeroHandlerDependencies = {},
): Promise<Response> {
  const rawSessionTokens = readSessionCookies(request.headers.get("cookie"))
  if (rawSessionTokens.length === 0) {
    return json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const session = await validateFirstSession(rawSessionTokens, dependencies)
    const result = await handleQueryRequest(
      (name, args) => transformZeroQuery(name, args, buildZeroContextFromSession(session)),
      schema,
      request,
      "info",
    )

    return json(result)
  } catch (error) {
    return appErrorJson(error)
  }
}

export async function handleZeroMutateRequest(): Promise<Response> {
  return json({ error: "Zero mutators are not enabled yet." }, { status: 501 })
}

async function validateFirstSession(
  rawSessionTokens: string[],
  dependencies: ZeroHandlerDependencies,
) {
  let lastError: unknown = null
  for (const rawSessionToken of rawSessionTokens) {
    try {
      return await (dependencies.validateSession ?? validateSessionDependency)({ rawSessionToken })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function validateSessionDependency(input: { rawSessionToken: string }) {
  const client = createDbClient()
  try {
    return await Effect.runPromise(
      validateBrowserSession(createPostgresBrowserAuthStore(client), input),
    )
  } finally {
    await client.end()
  }
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

function appErrorJson(error: unknown): Response {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const mapped = mapAppErrorToHttp(error as Parameters<typeof mapAppErrorToHttp>[0])
    return json(mapped.body, { status: mapped.status })
  }

  return json({ error: "Unexpected server error." }, { status: 500 })
}
