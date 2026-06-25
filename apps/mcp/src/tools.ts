import type { AuthenticatedContext } from "@contextbase/core/domains/auth/authenticate"

export type McpScope =
  | "contextbase:read"
  | "contextbase:write"
  | "contextbase:files"
  | "contextbase:manage"

export type McpToolServices = Record<string, never>

export type McpToolRuntime = {
  fileDownloadSecret?: string
  mcpResourceUrl: string
  services?: McpToolServices
}

type JsonSchema = {
  additionalProperties?: boolean
  properties?: Record<string, JsonSchema>
  required?: string[]
  type: "boolean" | "integer" | "number" | "object" | "string"
}

export type McpToolDescriptor = {
  annotations?: {
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
    readOnlyHint?: boolean
  }
  description: string
  inputSchema: JsonSchema
  name: string
}

type McpToolResult =
  | {
      data: unknown
      ok: true
    }
  | {
      error: {
        code: string
        message: string
      }
      ok: false
    }

const authProbeTool: McpToolDescriptor = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
  },
  description: "Return the authenticated Contextbase MCP context.",
  inputSchema: {
    additionalProperties: false,
    properties: {},
    required: [],
    type: "object",
  },
  name: "contextbase_auth_probe",
}

export function listMcpToolsForAuth(auth: AuthenticatedContext): McpToolDescriptor[] {
  return hasScope(auth, "contextbase:read") ? [authProbeTool] : []
}

export async function callMcpTool(
  name: string,
  auth: AuthenticatedContext,
  _args: Record<string, unknown>,
  _runtime: McpToolRuntime,
): Promise<McpToolResult> {
  if (name !== authProbeTool.name) {
    return {
      error: {
        code: "unknown_tool",
        message: `Unknown MCP tool: ${name}`,
      },
      ok: false,
    }
  }

  if (!hasScope(auth, "contextbase:read")) {
    return {
      error: {
        code: "forbidden",
        message: "MCP tool requires contextbase:read scope",
      },
      ok: false,
    }
  }

  return {
    data: {
      authKind: auth.authKind ?? null,
      grantId: auth.grantId ?? null,
      principalId: auth.principalId,
      principalKind: auth.principalKind,
      resource: auth.resource ?? null,
      role: auth.role,
      scopes: auth.scopes ?? null,
      workspaceId: auth.workspaceId,
      workspaceSlug: auth.workspaceSlug,
    },
    ok: true,
  }
}

function hasScope(auth: AuthenticatedContext, scope: McpScope) {
  return !auth.scopes || (auth.scopes as readonly string[]).includes(scope)
}
