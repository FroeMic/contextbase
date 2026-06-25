import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"
import type { BrowserSessionContext } from "@contextbase/core/domains/auth/browser-session"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"

import { requireBrowserSession } from "../domains/auth/server/session-context"
import { toTrpcError } from "./errors"

export type TrpcContext = {
  auth: AuthenticatedContext
  request: Request
  session: BrowserSessionContext
}

export async function createTrpcContext({
  req,
}: FetchCreateContextFnOptions): Promise<TrpcContext> {
  const { context, session } = await requireBrowserSession(req).catch((error) => {
    throw toTrpcError(error)
  })

  return {
    auth: context,
    request: req,
    session,
  }
}
