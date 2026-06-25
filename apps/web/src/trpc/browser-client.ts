import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"

import type { AppRouter } from "./router"

export function browserTrpcFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, credentials: "include" })
}

export function createBrowserTrpcClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        fetch: browserTrpcFetch,
        url: "/api/trpc",
      }),
    ],
  })
}

export const browserTrpcClient = createBrowserTrpcClient()
