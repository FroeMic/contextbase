export type ApiClientOptions = {
  baseUrl: string
  fetch?: typeof fetch
  token?: string
}

export type ApiClient = {
  delete: <TResponse>(path: string, body?: unknown) => Promise<TResponse>
  get: <TResponse>(path: string) => Promise<TResponse>
  getRaw: (path: string) => Promise<Response>
  patch: <TResponse>(path: string, body?: unknown) => Promise<TResponse>
  post: <TResponse>(path: string, body?: unknown) => Promise<TResponse>
  postForm: <TResponse>(path: string, body: FormData) => Promise<TResponse>
}

export type ApiErrorBody = {
  error?: {
    code?: string
    details?: Record<string, unknown>
    message?: string
  }
  ok?: false
}

export class ApiClientError extends Error {
  readonly body: ApiErrorBody | unknown
  readonly status: number

  constructor(input: { body: ApiErrorBody | unknown; message: string; status: number }) {
    super(input.message)
    this.name = "ApiClientError"
    this.body = input.body
    this.status = input.status
  }
}

function createUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString()
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? fetch

  function authHeaders() {
    const headers: Record<string, string> = {}

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`
    }

    return headers
  }

  async function request<TResponse>(
    method: "DELETE" | "GET" | "PATCH" | "POST",
    path: string,
    body?: unknown,
  ) {
    const headers = authHeaders()

    if (body !== undefined) {
      headers["content-type"] = "application/json"
    }

    const requestInit: RequestInit = {
      headers,
      method,
    }

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body)
    }

    const response = await fetchImpl(createUrl(options.baseUrl, path), requestInit)
    const responseBody = await readResponseBody(response)

    if (!response.ok || isApiErrorBody(responseBody)) {
      throw new ApiClientError({
        body: responseBody,
        message:
          extractApiErrorMessage(responseBody) ?? `API request failed with ${response.status}`,
        status: response.status,
      })
    }

    return responseBody as TResponse
  }

  async function postForm<TResponse>(path: string, body: FormData) {
    const response = await fetchImpl(createUrl(options.baseUrl, path), {
      body,
      headers: authHeaders(),
      method: "POST",
    })
    const responseBody = await readResponseBody(response)

    if (!response.ok || isApiErrorBody(responseBody)) {
      throw new ApiClientError({
        body: responseBody,
        message:
          extractApiErrorMessage(responseBody) ?? `API request failed with ${response.status}`,
        status: response.status,
      })
    }

    return responseBody as TResponse
  }

  async function getRaw(path: string) {
    const response = await fetchImpl(createUrl(options.baseUrl, path), {
      headers: authHeaders(),
      method: "GET",
    })

    if (!response.ok) {
      const responseBody = await readResponseBody(response.clone())
      throw new ApiClientError({
        body: responseBody,
        message:
          extractApiErrorMessage(responseBody) ?? `API request failed with ${response.status}`,
        status: response.status,
      })
    }

    return response
  }

  return {
    delete: (path, body) => request("DELETE", path, body),
    get: (path) => request("GET", path),
    getRaw,
    patch: (path, body) => request("PATCH", path, body),
    post: (path, body) => request("POST", path, body),
    postForm,
  }
}

async function readResponseBody(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "ok" in body &&
    (body as { ok?: unknown }).ok === false
  )
}

function extractApiErrorMessage(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorBody).error?.message === "string"
  ) {
    return (body as ApiErrorBody).error?.message
  }
  return null
}
