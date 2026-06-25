import type {
  WorkspaceMemberListResponse,
  WorkspaceMemberResponse,
  WorkspaceMemberUpdateBody,
} from "@contextbase/contracts"

import type { ApiClient } from "../client"

export function createWorkspaceMemberClient(client: ApiClient) {
  return {
    disable: (membershipId: string) =>
      client.post<WorkspaceMemberResponse>(`/api/v1/workspace-members/${membershipId}/disable`),
    list: () => client.get<WorkspaceMemberListResponse>("/api/v1/workspace-members"),
    reactivate: (membershipId: string) =>
      client.post<WorkspaceMemberResponse>(`/api/v1/workspace-members/${membershipId}/reactivate`),
    update: (membershipId: string, payload: WorkspaceMemberUpdateBody) =>
      client.patch<WorkspaceMemberResponse>(`/api/v1/workspace-members/${membershipId}`, payload),
  }
}
