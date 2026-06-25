import type {
  WorkspaceCreateBody,
  WorkspaceListResponse,
  WorkspaceRenameSlugBody,
  WorkspaceResponse,
  WorkspaceUpdateBody,
} from "@contextbase/contracts"

import type { ApiClient } from "../client"

export type WorkspacePayload = WorkspaceCreateBody

export function createWorkspaceClient(client: ApiClient) {
  return {
    archive: (workspaceIdOrSlug: string) =>
      client.post<WorkspaceResponse>(`/api/v1/workspaces/${workspaceIdOrSlug}/archive`),
    create: (payload: WorkspacePayload) =>
      client.post<WorkspaceResponse>("/api/v1/workspaces", payload),
    get: (workspaceIdOrSlug: string) =>
      client.get<WorkspaceResponse>(`/api/v1/workspaces/${workspaceIdOrSlug}`),
    list: () => client.get<WorkspaceListResponse>("/api/v1/workspaces"),
    renameSlug: (workspaceIdOrSlug: string, newSlug: string) =>
      client.post<WorkspaceResponse>(`/api/v1/workspaces/${workspaceIdOrSlug}/rename-slug`, {
        newSlug,
      } satisfies WorkspaceRenameSlugBody),
    reactivate: (workspaceIdOrSlug: string) =>
      client.post<WorkspaceResponse>(`/api/v1/workspaces/${workspaceIdOrSlug}/reactivate`),
    update: (workspaceIdOrSlug: string, payload: WorkspaceUpdateBody) =>
      client.patch<WorkspaceResponse>(`/api/v1/workspaces/${workspaceIdOrSlug}`, payload),
  }
}
