import type { QueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"

import { createBrowserTrpcClient } from "./browser-client"
import { trpc } from "./react"

export function TrpcProvider({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  const [trpcClient] = useState(() => createBrowserTrpcClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  )
}
