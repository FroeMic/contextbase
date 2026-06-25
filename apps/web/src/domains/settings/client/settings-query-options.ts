import { queryOptions } from "@tanstack/react-query"

import { browserTrpcClient } from "../../../trpc/browser-client"

export const settingsQueryKeys = {
  apiTokens: () => ["settings", "api-tokens"] as const,
  oauthGrants: () => ["settings", "oauth-grants"] as const,
  security: () => ["settings", "security"] as const,
  securitySessions: () => ["settings", "security", "sessions"] as const,
}

export function apiTokensSettingsQueryOptions() {
  return queryOptions({
    queryFn: () => browserTrpcClient.settings.apiTokens.listMine.query(),
    queryKey: settingsQueryKeys.apiTokens(),
    staleTime: 30_000,
  })
}

export function oauthGrantsSettingsQueryOptions() {
  return queryOptions({
    queryFn: () => browserTrpcClient.settings.oauthGrants.listMine.query(),
    queryKey: settingsQueryKeys.oauthGrants(),
    staleTime: 30_000,
  })
}

export function securitySessionsSettingsQueryOptions() {
  return queryOptions({
    queryFn: () => browserTrpcClient.settings.security.listSessions.query(),
    queryKey: settingsQueryKeys.securitySessions(),
    staleTime: 30_000,
  })
}

export function securitySettingsQueryOptions() {
  return queryOptions({
    queryFn: () => browserTrpcClient.settings.security.get.query(),
    queryKey: settingsQueryKeys.security(),
    staleTime: 30_000,
  })
}
