import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

import { createTrpcContext } from "./context"
import { appRouter } from "./router"

export function handleTrpcRequest(request: Request): Promise<Response> {
  return fetchRequestHandler({
    createContext: createTrpcContext,
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
  })
}
