export type ZeroAuthContext = {
  activeWorkspaceId: string
  activeWorkspaceRole: string
  activeWorkspaceSlug: string
  capabilities: string[]
  userId: string
}

export type WorkspaceScopedRow = {
  workspaceId: string
}

export function canReadWorkspaceRow(context: ZeroAuthContext, row: WorkspaceScopedRow) {
  return row.workspaceId === context.activeWorkspaceId
}
