export type WorkspaceMemberRole = "workspace_admin" | "workspace_member"
export type WorkspaceMemberStatus = "active" | "disabled"

export type WorkspaceMemberDto = {
  displayName: string | null
  email: string | null
  id: string
  principalId: string
  principalKind: string
  role: string
  status: string
  workspaceId: string
  workspaceSlug: string
}

export type UpdateWorkspaceMemberInput = {
  membershipId: string
  role?: WorkspaceMemberRole
}

export type DisableWorkspaceMemberInput = {
  membershipId: string
}

export type ReactivateWorkspaceMemberInput = {
  membershipId: string
}
