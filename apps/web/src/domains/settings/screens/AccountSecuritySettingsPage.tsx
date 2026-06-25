import { queries } from "@contextbase/zero-schema"
import { useQuery as useZeroQuery } from "@rocicorp/zero/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { trpc } from "../../../trpc/react"
import { useSession } from "../../auth/client/use-session"
import { buildPublicAvatarUrl } from "../client/public-avatar-url"
import {
  apiTokensSettingsQueryOptions,
  oauthGrantsSettingsQueryOptions,
  settingsQueryKeys,
} from "../client/settings-query-options"
import { ActiveSessionsSettingsSection } from "../components/ActiveSessionsSettingsSection"
import {
  type ApiTokenScope,
  ApiTokensSettingsSection,
} from "../components/ApiTokensSettingsSection"
import { OAuthGrantsSettingsSection } from "../components/OAuthGrantsSettingsSection"
import { PasswordSettingsSection } from "../components/PasswordSettingsSection"
import { SettingsPage, SettingsPageContent, SettingsPageTitle } from "../components/SettingsLayout"
import type { SettingsPrincipal } from "../components/SettingsPrincipal"

export function AccountSecuritySettingsPage() {
  const session = useSession()
  const oauthGrantsQuery = useQuery(oauthGrantsSettingsQueryOptions())
  const apiTokensQuery = useQuery(apiTokensSettingsQueryOptions())
  const createApiTokenMutation = trpc.settings.apiTokens.createMine.useMutation()
  const revokeApiTokenMutation = trpc.settings.apiTokens.revokeMine.useMutation()
  const updateApiTokenMutation = trpc.settings.apiTokens.updateMine.useMutation()
  const revokeOAuthGrantMutation = trpc.settings.oauthGrants.revokeMine.useMutation()
  const updateOAuthGrantMutation = trpc.settings.oauthGrants.updateMine.useMutation()
  const queryClient = useQueryClient()
  const [currentUser] = useZeroQuery(queries.currentUser())
  const [currentUserAvatarFile] = useZeroQuery(
    currentUser?.avatarFileObjectId
      ? queries.publicAvatarFile({ fileId: currentUser.avatarFileObjectId })
      : null,
  )
  const canGrantAdminScope = session.data
    ? canAdminWorkspaceRole(session.data.activeWorkspaceRole)
    : false
  const currentUserPrincipal: SettingsPrincipal = {
    avatarUrl: buildPublicAvatarUrl(currentUserAvatarFile),
    displayName: currentUser?.displayName ?? session.data?.email ?? "You",
    id: session.data?.userId ?? "",
    kind: "user",
  }
  const settingsPrincipals: SettingsPrincipal[] = [currentUserPrincipal]

  async function updateOAuthGrantScopes(
    grantId: string,
    scope: Array<
      | "contextbase:read"
      | "contextbase:write"
      | "contextbase:files"
      | "contextbase:manage"
      | "offline_access"
    >,
  ) {
    await updateOAuthGrantMutation.mutateAsync({ grantId, scope })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.oauthGrants() })
    toast.success("Application permissions updated.")
  }

  async function revokeOAuthGrant(grantId: string) {
    await revokeOAuthGrantMutation.mutateAsync({ grantId })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.oauthGrants() })
    toast.success("Application access revoked.")
  }

  async function createPersonalApiToken(input: { label: string; scope: ApiTokenScope[] }) {
    const result = await createApiTokenMutation.mutateAsync(input)
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiTokens() })
    toast.success("API key created.")
    return { rawToken: result.rawToken }
  }

  async function updatePersonalApiToken(input: {
    label: string
    scope: ApiTokenScope[]
    tokenId: string
  }) {
    await updateApiTokenMutation.mutateAsync(input)
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiTokens() })
    toast.success("API key updated.")
  }

  async function revokePersonalApiToken(tokenId: string) {
    await revokeApiTokenMutation.mutateAsync({ tokenId })
    await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiTokens() })
    toast.success("API key revoked.")
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>Security</SettingsPageTitle>

        <PasswordSettingsSection />
        <ActiveSessionsSettingsSection />

        <ApiTokensSettingsSection
          canGrantAdminScope={canGrantAdminScope}
          createLabel="New API key"
          emptyText="No API keys created"
          isLoading={apiTokensQuery.isPending}
          isMutating={
            createApiTokenMutation.isPending ||
            revokeApiTokenMutation.isPending ||
            updateApiTokenMutation.isPending
          }
          onCreate={createPersonalApiToken}
          onRevoke={revokePersonalApiToken}
          onUpdate={updatePersonalApiToken}
          principal={currentUserPrincipal}
          sectionDescription=""
          sectionTitle="Personal API keys"
          showRowScopeSummary={false}
          tokens={apiTokensQuery.data ?? []}
        />

        <OAuthGrantsSettingsSection
          canGrantAdminScope={canGrantAdminScope}
          grants={oauthGrantsQuery.data ?? []}
          isLoading={oauthGrantsQuery.isPending}
          isMutating={revokeOAuthGrantMutation.isPending || updateOAuthGrantMutation.isPending}
          onRevoke={revokeOAuthGrant}
          onUpdateScopes={updateOAuthGrantScopes}
          principals={settingsPrincipals}
          sectionDescription="OAuth applications that act on your behalf."
        />
      </SettingsPageContent>
    </SettingsPage>
  )
}

function canAdminWorkspaceRole(role: string) {
  return role === "workspace_admin"
}
