export type WorkspaceStatus = "active" | "archived" | "suspended"

export type WorkspaceDto = {
  id: string
  status: string
  workspaceName: string
  workspaceSlug: string
}

export type CreateWorkspaceInput = {
  workspaceName: string
  workspaceSlug: string
}

export type UpdateWorkspaceInput = {
  status?: WorkspaceStatus
  workspaceIdOrSlug: string
  workspaceName?: string
}

export type ArchiveWorkspaceInput = {
  workspaceIdOrSlug: string
}

export type ReactivateWorkspaceInput = {
  workspaceIdOrSlug: string
}

export type RenameWorkspaceSlugInput = {
  newSlug: string
  workspaceIdOrSlug: string
}
