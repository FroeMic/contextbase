import { createRouter as createTanStackRouter } from "@tanstack/react-router"

import { createAppQueryClient } from "./app/providers/app-query-client"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = createAppQueryClient()

  return createTanStackRouter({
    context: {
      queryClient,
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    routeTree,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
