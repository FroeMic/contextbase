import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { createServerEntry } from "@tanstack/react-start/server-entry"

import { maybeHandleApiRequest } from "./server-api"
import { maybeHandleInfrastructureRequest } from "./server-infrastructure"

const startHandler = createStartHandler(defaultStreamHandler)

export async function handleRequest({ request }: { request: Request }): Promise<Response> {
  return handleFetchRequest(request)
}

export async function handleFetchRequest(request: Request): Promise<Response> {
  const infrastructureResponse = await maybeHandleInfrastructureRequest(request)
  if (infrastructureResponse) return infrastructureResponse
  const apiResponse = await maybeHandleApiRequest(request)
  if (apiResponse) return apiResponse
  return startHandler(request)
}

export default createServerEntry({
  fetch: handleFetchRequest,
})
