import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"

import type { Logger } from "./logger"

export type ApiServices = Record<string, unknown>

export type ApiRequestContext = {
  auth: AuthenticatedContext
  requestId: string
  services: ApiServices
}

export type RouteDependencies = {
  authenticateApiToken?: (token: string) => Promise<AuthenticatedContext>
  logger?: Logger
  requestId?: () => string
  services?: ApiServices
}
