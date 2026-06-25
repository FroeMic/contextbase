import { queryOptions, useQuery } from "@tanstack/react-query"

import { type AuthApiOptions, fetchCurrentSession } from "./auth-api"

export const sessionQueryKey = ["auth", "session"] as const

export function sessionQueryOptions(options: AuthApiOptions = {}) {
  return queryOptions({
    queryFn: async () => {
      const response = await fetchCurrentSession(options)
      return response.data
    },
    queryKey: sessionQueryKey,
    retry: false,
    staleTime: 30_000,
  })
}

export function useSession() {
  return useQuery(sessionQueryOptions())
}
