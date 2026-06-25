import type { QueryClient } from "@tanstack/react-query"

import {
  securitySessionsSettingsQueryOptions,
  securitySettingsQueryOptions,
} from "../client/settings-query-options"

const SECURITY_SETTINGS_ROUTE_SUFFIX = "/settings/account/security"

export async function prefetchSettingsPage({
  pathname,
  queryClient,
}: {
  pathname: string
  queryClient: QueryClient
}) {
  if (!pathname.endsWith(SECURITY_SETTINGS_ROUTE_SUFFIX)) {
    return
  }

  await Promise.all([
    queryClient.prefetchQuery(securitySettingsQueryOptions()),
    queryClient.prefetchQuery(securitySessionsSettingsQueryOptions()),
  ])
}
