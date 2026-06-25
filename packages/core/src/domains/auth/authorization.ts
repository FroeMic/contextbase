import type { AuthenticatedContext } from "./authenticate"

export function canAdministerWorkspace(context: AuthenticatedContext): boolean {
  const hasScopedAdminGrant = !context.scopes || context.scopes.includes("contextbase:manage")

  if (!hasScopedAdminGrant) return false

  if (context.principalKind === "agent") {
    return context.role === "workspace_agent"
  }

  return context.role === "workspace_admin"
}
