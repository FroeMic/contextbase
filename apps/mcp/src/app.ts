import { randomUUID } from "node:crypto"
import { createDbClient, type DbClient } from "@contextbase/core"
import {
  type AuthenticatedContext,
  authenticateBearerToken,
  extractBearerToken,
} from "@contextbase/core/domains/auth/authenticate"
import { createPostgresFileStore } from "@contextbase/core/domains/files/repository"
import { getFileContentDescriptor } from "@contextbase/core/domains/files/service"
import type { StorageProvider } from "@contextbase/core/domains/files/storage"
import { sanitizeDownloadFilename } from "@contextbase/core/domains/files/storage"
import { errorEnvelope, successEnvelope } from "@contextbase/core/shared/response"
import { Effect } from "effect"
import { Hono } from "hono"

import { verifyFileDownloadToken } from "./file-download-links.js"
import { callMcpTool, listMcpToolsForAuth, type McpToolServices } from "./tools.js"

export type CreateMcpAppOptions = {
  authBaseUrl: string
  authenticateBearerToken?: (token: string) => Promise<AuthenticatedContext>
  dbClient?: DbClient
  fileDownloadSecret?: string
  fileStorage?: StorageProvider
  logger?: McpLogger
  mcpResourceUrl: string
  toolServices?: McpToolServices
}

type McpLogEntry = {
  event: string
  [key: string]: unknown
}

type McpLogger = {
  error?: (entry: McpLogEntry) => void
  info: (entry: McpLogEntry) => void
  warn: (entry: McpLogEntry) => void
}

const defaultScopes = ["contextbase:read", "contextbase:write", "contextbase:files"] as const
const supportedScopes = [...defaultScopes, "contextbase:manage"] as const
const requestIds = new WeakMap<Request, string>()

export function createMcpApp(options: CreateMcpAppOptions) {
  const app = new Hono()

  app.use("*", async (context, next) => {
    const startedAt = Date.now()
    const requestId = getRequestId(context.req.raw)
    const path = requestPath(context.req.raw)
    if (path !== "/healthz") {
      logInfo(options, {
        event: "mcp.request.started",
        method: context.req.method,
        path,
        requestId,
        userAgent: context.req.header("user-agent") ?? null,
      })
    }

    await next()

    if (path !== "/healthz") {
      logInfo(options, {
        durationMs: Date.now() - startedAt,
        event: "mcp.request.completed",
        method: context.req.method,
        path,
        requestId,
        status: context.res.status,
      })
    }
  })

  app.get("/healthz", (context) =>
    context.json(successEnvelope({ service: "mcp", status: "ok" }), 200),
  )

  app.get("/.well-known/oauth-protected-resource/mcp", (context) => {
    logInfo(options, {
      authBaseUrl: options.authBaseUrl,
      event: "mcp.oauth_protected_resource.request",
      requestId: getRequestId(context.req.raw),
      resource: options.mcpResourceUrl,
    })
    return context.json(protectedResourceMetadata(options), 200)
  })

  app.get("/mcp", async (context) => {
    const auth = await authenticateMcpRequest(context.req.raw, options)
    if (!auth.ok) {
      return context.json(auth.body, auth.status, {
        "WWW-Authenticate": authChallenge(options),
      })
    }

    return streamableHttpServerStream()
  })

  app.post("/mcp", async (context) => {
    const auth = await authenticateMcpRequest(context.req.raw, options)
    if (!auth.ok) {
      return context.json(auth.body, auth.status, {
        "WWW-Authenticate": authChallenge(options),
      })
    }

    const message = await readJsonRpcRequest(context.req.raw)
    if (!message.ok) {
      logWarn(options, {
        event: "mcp.json_rpc.failed",
        reason: "parse_error",
        requestId: getRequestId(context.req.raw),
      })
      return context.json(jsonRpcError(null, -32700, "Parse error"), 400)
    }
    if (!isJsonRpcRequestWithId(message.value)) {
      logInfo(options, {
        event: "mcp.json_rpc.notification",
        method: message.value.method,
        requestId: getRequestId(context.req.raw),
      })
      return context.body(null, 202)
    }

    return context.json(await handleJsonRpc(message.value, auth.value, options), 200)
  })

  app.get("/mcp/files/:fileId/content", async (context) => {
    const token = context.req.query("token")
    const secret = options.fileDownloadSecret
    if (!token || !secret) {
      return context.json(errorEnvelope("unauthenticated", "Missing file download token"), 401)
    }

    const payload = verifyFileDownloadToken(token, secret)
    const fileId = context.req.param("fileId")
    if (!payload || payload.fileId !== fileId) {
      return context.json(errorEnvelope("unauthenticated", "Invalid file download token"), 401)
    }

    const storage = options.fileStorage
    if (!storage) {
      return context.json(errorEnvelope("internal_error", "File storage is not configured"), 500)
    }

    const auth: AuthenticatedContext = {
      authKind: "oauth_access_token",
      principalId: payload.principalId,
      principalKind: payload.principalKind,
      resource: options.mcpResourceUrl,
      role: "workspace_member",
      scopes: contextbaseScopes("contextbase:files"),
      workspaceId: payload.workspaceId,
      workspaceSlug: payload.workspaceSlug,
    }

    const client = options.dbClient ?? createDbClient()
    try {
      const descriptor = await Effect.runPromise(
        getFileContentDescriptor(createPostgresFileStore(client), auth, { fileId }),
      )
      const object = await Effect.runPromise(storage.getObject(descriptor.objectKey))
      return new Response(toResponseBody(object.body), {
        headers: contentHeaders({
          byteSize: descriptor.byteSize,
          contentType: descriptor.contentType,
          originalFilename: descriptor.originalFilename,
        }),
      })
    } catch {
      return context.json(errorEnvelope("not_found", "File not found"), 404)
    } finally {
      if (!options.dbClient) await client.end()
    }
  })

  app.notFound((context) => context.json(errorEnvelope("not_found", "Route not found"), 404))

  return app
}

function streamableHttpServerStream() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"))
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  })
}

async function authenticateMcpRequest(request: Request, options: CreateMcpAppOptions) {
  const requestId = getRequestId(request)
  const token = extractBearerToken(request)
  if (!token) {
    logWarn(options, {
      event: "mcp.auth.failed",
      reason: "missing_bearer_token",
      requestId,
    })
    return {
      body: errorEnvelope("unauthenticated", "Missing MCP bearer token"),
      ok: false,
      status: 401,
    } as const
  }

  try {
    const auth = options.authenticateBearerToken
      ? await options.authenticateBearerToken(token)
      : await authenticateWithDb(token, options)

    if (auth.authKind !== "oauth_access_token" || auth.resource !== options.mcpResourceUrl) {
      logWarn(options, {
        authKind: auth.authKind,
        event: "mcp.auth.failed",
        expectedResource: options.mcpResourceUrl,
        principalId: auth.principalId,
        principalKind: auth.principalKind,
        reason: "wrong_audience",
        requestId,
        resource: auth.resource,
        workspaceId: auth.workspaceId,
      })
      return {
        body: errorEnvelope("forbidden", "MCP requires an MCP-audience OAuth access token"),
        ok: false,
        status: 403,
      } as const
    }

    logInfo(options, {
      authKind: auth.authKind,
      event: "mcp.auth.succeeded",
      principalId: auth.principalId,
      principalKind: auth.principalKind,
      requestId,
      scopes: auth.scopes,
      workspaceId: auth.workspaceId,
      workspaceSlug: auth.workspaceSlug,
    })
    return { ok: true, value: auth } as const
  } catch (error) {
    logWarn(options, {
      errorName: error instanceof Error ? error.name : typeof error,
      event: "mcp.auth.failed",
      reason: "invalid_token",
      requestId,
    })
    return {
      body: errorEnvelope("unauthenticated", "Invalid MCP bearer token"),
      ok: false,
      status: 401,
    } as const
  }
}

async function authenticateWithDb(token: string, options: CreateMcpAppOptions) {
  const client = options.dbClient ?? createDbClient()
  try {
    return await Effect.runPromise(
      authenticateBearerToken(client, token, {
        allowedOAuthResources: [options.mcpResourceUrl],
      }),
    )
  } finally {
    if (!options.dbClient) await client.end()
  }
}

async function handleJsonRpc(
  message: JsonRpcRequestWithId,
  auth: AuthenticatedContext,
  options: CreateMcpAppOptions,
) {
  logInfo(options, {
    event: "mcp.json_rpc.request",
    idPresent: message.id !== undefined,
    method: message.method,
    principalId: auth.principalId,
    principalKind: auth.principalKind,
    workspaceId: auth.workspaceId,
  })

  if (message.method === "initialize") {
    return {
      id: message.id,
      jsonrpc: "2.0",
      result: {
        capabilities: { tools: {} },
        protocolVersion: "2024-11-05",
        serverInfo: { name: "contextbase", version: "0.1.0" },
      },
    }
  }

  if (message.method === "tools/list") {
    const tools = listMcpToolsForAuth(auth)
    logInfo(options, {
      count: tools.length,
      event: "mcp.tools.list",
      principalId: auth.principalId,
      workspaceId: auth.workspaceId,
    })
    return {
      id: message.id,
      jsonrpc: "2.0",
      result: {
        tools,
      },
    }
  }

  if (message.method === "tools/call") {
    const params = isRecord(message.params) ? message.params : {}
    if (typeof params.name !== "string") {
      logWarn(options, {
        event: "mcp.tools.call.failed",
        reason: "missing_tool_name",
        workspaceId: auth.workspaceId,
      })
      return jsonRpcError(message.id, -32602, "Unknown tool")
    }

    const runtime = {
      ...(options.dbClient ? { dbClient: options.dbClient } : {}),
      ...(options.fileDownloadSecret ? { fileDownloadSecret: options.fileDownloadSecret } : {}),
      ...(options.fileStorage ? { fileStorage: options.fileStorage } : {}),
      mcpResourceUrl: options.mcpResourceUrl,
      ...(options.toolServices ? { services: options.toolServices } : {}),
    }
    const toolResult = await callMcpTool(
      params.name,
      auth,
      isRecord(params.arguments) ? params.arguments : {},
      runtime,
    )
    logInfo(options, {
      event: toolResult.ok ? "mcp.tools.call.succeeded" : "mcp.tools.call.failed",
      principalId: auth.principalId,
      principalKind: auth.principalKind,
      reason: toolResult.ok ? undefined : toolResult.error.code,
      toolName: params.name,
      workspaceId: auth.workspaceId,
    })

    const structuredContent = toolResult.ok
      ? toolResult.data
      : { ok: false, error: toolResult.error }

    const result: {
      content: Array<{ text: string; type: string }>
      isError?: true
      structuredContent: unknown
    } = {
      content: [
        {
          text: JSON.stringify(structuredContent),
          type: "text",
        },
      ],
      structuredContent,
    }

    if (!toolResult.ok) result.isError = true

    return {
      id: message.id,
      jsonrpc: "2.0",
      result,
    }
  }

  return jsonRpcError(message.id, -32601, "Method not found")
}

function contentHeaders(input: {
  byteSize: number
  contentType: string
  originalFilename: string | null
}) {
  return {
    "Cache-Control": "private, max-age=60",
    "Content-Disposition": `attachment; filename="${sanitizeDownloadFilename(
      input.originalFilename,
    )}"`,
    "Content-Length": String(input.byteSize),
    "Content-Type": input.contentType,
    "X-Content-Type-Options": "nosniff",
  }
}

function toResponseBody(body: unknown): ConstructorParameters<typeof Response>[0] {
  if (body instanceof Uint8Array) {
    const copy = new ArrayBuffer(body.byteLength)
    new Uint8Array(copy).set(body)
    return new Blob([copy])
  }
  if (body instanceof ReadableStream) return body
  if (body && typeof body === "object" && "pipe" in body) {
    return body as unknown as ConstructorParameters<typeof Response>[0]
  }
  throw new Error("Unsupported storage response body")
}

function protectedResourceMetadata(options: CreateMcpAppOptions) {
  return {
    resource: options.mcpResourceUrl,
    authorization_servers: [options.authBaseUrl],
    scopes_supported: [...supportedScopes],
  }
}

function authChallenge(options: CreateMcpAppOptions) {
  const metadataUrl = new URL("/.well-known/oauth-protected-resource/mcp", options.mcpResourceUrl)
  return `Bearer resource_metadata="${metadataUrl.toString()}", scope="${defaultScopes.join(" ")}"`
}

function contextbaseScopes(...scopes: string[]): NonNullable<AuthenticatedContext["scopes"]> {
  return scopes as unknown as NonNullable<AuthenticatedContext["scopes"]>
}

async function readJsonRpcRequest(request: Request) {
  try {
    const value = (await request.json()) as unknown
    return isJsonRpcRequest(value) ? ({ ok: true, value } as const) : ({ ok: false } as const)
  } catch {
    return { ok: false } as const
  }
}

type JsonRpcRequest = {
  id?: number | string | null
  jsonrpc: "2.0"
  method: string
  params?: unknown
}

type JsonRpcRequestWithId = JsonRpcRequest & {
  id: number | string | null
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.method === "string" &&
    ("id" in value ? isJsonRpcId(value.id) : true)
  )
}

function isJsonRpcRequestWithId(value: JsonRpcRequest): value is JsonRpcRequestWithId {
  return "id" in value && isJsonRpcId(value.id)
}

function isJsonRpcId(value: unknown): value is number | string | null {
  return value === null || typeof value === "number" || typeof value === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function jsonRpcError(id: number | string | null, code: number, message: string) {
  return {
    error: {
      code,
      message,
    },
    id,
    jsonrpc: "2.0",
  }
}

function getRequestId(request: Request) {
  const headerRequestId = request.headers.get("x-request-id")
  if (headerRequestId) return headerRequestId
  const existing = requestIds.get(request)
  if (existing) return existing
  const requestId = randomUUID()
  requestIds.set(request, requestId)
  return requestId
}

function requestPath(request: Request) {
  return new URL(request.url).pathname
}

function logInfo(options: CreateMcpAppOptions, entry: McpLogEntry) {
  ;(options.logger ?? defaultLogger).info(withService(entry))
}

function logWarn(options: CreateMcpAppOptions, entry: McpLogEntry) {
  ;(options.logger ?? defaultLogger).warn(withService(entry))
}

function withService(entry: McpLogEntry): McpLogEntry {
  return {
    service: "mcp",
    timestamp: new Date().toISOString(),
    ...entry,
  }
}

const defaultLogger: McpLogger = {
  error: (entry) => {
    if (process.env.NODE_ENV !== "test") console.error(JSON.stringify(entry))
  },
  info: (entry) => {
    if (process.env.NODE_ENV !== "test") console.info(JSON.stringify(entry))
  },
  warn: (entry) => {
    if (process.env.NODE_ENV !== "test") console.warn(JSON.stringify(entry))
  },
}
