import { createPostHogProxyRequestHandler } from "./domains/analytics/posthog-server"

type InfrastructureRequestHandlerDependencies = {
  env?: NodeJS.ProcessEnv
  fetch?: (request: Request) => Promise<Response>
}

export function createInfrastructureRequestHandler(
  dependencies: InfrastructureRequestHandlerDependencies = {},
) {
  const env = dependencies.env ?? process.env
  const ingestTarget = env.POSTHOG_PROXY_TARGET?.trim()
  const assetTarget = env.POSTHOG_ASSET_PROXY_TARGET?.trim()

  if (!ingestTarget || !assetTarget) {
    return async function maybeHandleInfrastructureRequest(): Promise<Response | null> {
      return null
    }
  }

  return createPostHogProxyRequestHandler({
    assetTarget,
    fetch: dependencies.fetch,
    ingestTarget,
  })
}

export const maybeHandleInfrastructureRequest = createInfrastructureRequestHandler()
