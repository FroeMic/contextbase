import type { OAuthScope } from "@contextbase/core/domains/oauth/service"

export function requiredScopeForApiRequest(request: Request): OAuthScope {
  const path = new URL(request.url).pathname
  const method = request.method.toUpperCase()

  if (requiresAdminScope(method, path)) {
    return "contextbase:manage"
  }

  if (requiresFileScope(method, path)) {
    return "contextbase:files"
  }

  return method === "GET" || method === "HEAD" ? "contextbase:read" : "contextbase:write"
}

function requiresAdminScope(method: string, path: string): boolean {
  return (
    (method === "POST" && (path === "/api/v1/workspaces" || path === "/api/v1/users")) ||
    (method === "PATCH" && /^\/api\/v1\/users\/[^/]+$/.test(path)) ||
    (method === "POST" && /^\/api\/v1\/workspaces\/[^/]+\/(archive|reactivate)$/.test(path)) ||
    (method === "GET" && path === "/api/v1/workspace-invitations") ||
    (method === "POST" && path === "/api/v1/workspace-invitations") ||
    (method === "POST" && /^\/api\/v1\/workspace-invitations\/[^/]+\/revoke$/.test(path)) ||
    (method === "GET" && path === "/api/v1/workspace-members") ||
    ((method === "PATCH" || method === "POST") &&
      /^\/api\/v1\/workspace-members\/[^/]+(\/disable|\/reactivate)?$/.test(path)) ||
    (method === "POST" && path === "/api/v1/feature-flags/rules") ||
    ((method === "PATCH" || method === "DELETE") &&
      /^\/api\/v1\/feature-flags\/rules\/[^/]+$/.test(path)) ||
    (method === "PATCH" && /^\/api\/v1\/workspaces\/[^/]+$/.test(path)) ||
    (method === "POST" && /^\/api\/v1\/workspaces\/[^/]+\/rename-slug$/.test(path))
  )
}

function requiresFileScope(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD") && /^\/api\/v1\/files\/[^/]+\/content$/.test(path)
}
