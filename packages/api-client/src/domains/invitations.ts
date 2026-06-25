import type {
  WorkspaceInvitationCreateBody,
  WorkspaceInvitationListResponse,
  WorkspaceInvitationResponse,
} from "@contextbase/contracts"

import type { ApiClient } from "../client"

export function createWorkspaceInvitationClient(client: ApiClient) {
  return {
    create: (payload: WorkspaceInvitationCreateBody) =>
      client.post<WorkspaceInvitationResponse>("/api/v1/workspace-invitations", payload),
    list: () => client.get<WorkspaceInvitationListResponse>("/api/v1/workspace-invitations"),
    revoke: (invitationId: string) =>
      client.post<WorkspaceInvitationResponse>(
        `/api/v1/workspace-invitations/${invitationId}/revoke`,
        {},
      ),
  }
}
