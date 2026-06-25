import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../shared/ui/button"
import {
  MobileFriendlyDialog,
  MobileFriendlyDialogContent,
  MobileFriendlyDialogDescription,
  MobileFriendlyDialogFooter,
  MobileFriendlyDialogHeader,
  MobileFriendlyDialogTitle,
} from "../../../shared/ui/mobile-friendly-dialog"
import { SettingsDialogDetailRow } from "./SettingsDialogDetails"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "./SettingsLayout"
import { PrincipalAvatar, type SettingsPrincipal } from "./SettingsPrincipal"

type OAuthScope =
  | "contextbase:read"
  | "contextbase:write"
  | "contextbase:files"
  | "contextbase:manage"
  | "offline_access"

export type OAuthGrantSettingsItem = {
  actorId: string
  actorKind: string
  clientId: string
  clientName: string
  createdAt: Date | string
  id: string
  lastUsedAt: Date | string | null
  resource: string
  scope: OAuthScope[]
  updatedAt: Date | string
  workspaceSlug: string
}

type OAuthGrantsSettingsSectionProps = {
  canGrantAdminScope?: boolean
  emptyText?: string
  grants: OAuthGrantSettingsItem[]
  isLoading: boolean
  isMutating: boolean
  onRevoke: (grantId: string) => Promise<void>
  onUpdateScopes: (grantId: string, scope: OAuthScope[]) => Promise<void>
  principals?: SettingsPrincipal[]
  sectionDescription?: string
  sectionTitle?: string
}

const configurableScopes = [
  {
    label: "Read Contextbase data",
    value: "contextbase:read",
  },
  {
    label: "Create and update data",
    value: "contextbase:write",
  },
  {
    label: "Use file links",
    value: "contextbase:files",
  },
  {
    label: "Manage workspace",
    value: "contextbase:manage",
  },
] as const

const compactDialogContentClassName =
  "flex max-h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
const fullScreenDrawerContentClassName =
  "h-[100dvh] max-h-[100dvh] rounded-none p-0 before:inset-0 before:rounded-none data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh]"
const compactDialogHeaderClassName = "px-5 pt-5 pb-4"
const compactDialogBodyClassName =
  "min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]"
const compactDialogFooterClassName = "border-t border-border px-5 py-4"

export function OAuthGrantsSettingsSection({
  canGrantAdminScope = false,
  emptyText = "No applications have been authorized to connect with your account.",
  grants,
  isLoading,
  isMutating,
  onRevoke,
  onUpdateScopes,
  principals = [],
  sectionDescription = "OAuth applications you've approved.",
  sectionTitle = "Authorized applications",
}: OAuthGrantsSettingsSectionProps) {
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null)
  const selectedGrant = useMemo(
    () => grants.find((grant) => grant.id === selectedGrantId) ?? null,
    [grants, selectedGrantId],
  )
  const [selectedScopes, setSelectedScopes] = useState<OAuthScope[]>([])

  useEffect(() => {
    if (selectedGrant) setSelectedScopes(selectedGrant.scope)
  }, [selectedGrant])

  async function updateScopes() {
    if (!selectedGrant) return
    const preservedScopes = selectedGrant.scope.filter(
      (scope) => scope === "offline_access" && !selectedScopes.includes(scope),
    )
    await onUpdateScopes(selectedGrant.id, [...selectedScopes, ...preservedScopes])
  }

  async function revokeSelectedGrant() {
    if (!selectedGrant) return
    const confirmed = window.confirm(`Revoke access for ${selectedGrant.clientName}?`)
    if (!confirmed) return
    await onRevoke(selectedGrant.id)
    setSelectedGrantId(null)
  }

  return (
    <SettingsSection>
      <SettingsSectionTitle>{sectionTitle}</SettingsSectionTitle>
      <SettingsSectionDescription>{sectionDescription}</SettingsSectionDescription>
      <SettingsCard>
        {isLoading ? (
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Loading applications</SettingsRowTitle>
              <SettingsRowDescription>Checking approved OAuth connections.</SettingsRowDescription>
            </SettingsRowLabel>
          </SettingsRow>
        ) : grants.length === 0 ? (
          <SettingsRow>
            <SettingsRowDescription>{emptyText}</SettingsRowDescription>
          </SettingsRow>
        ) : (
          grants.map((grant) => {
            const principal = resolveGrantPrincipal({ grant, principals })

            return (
              <button
                className="flex w-full items-center gap-3 px-5 py-5 text-left transition-colors hover:bg-muted/50"
                key={grant.id}
                onClick={() => setSelectedGrantId(grant.id)}
                type="button"
              >
                <PrincipalAvatar principal={principal} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{grant.clientName}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {grant.workspaceSlug} · {formatActor(principal)}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </SettingsCard>

      <MobileFriendlyDialog
        open={Boolean(selectedGrant)}
        onOpenChange={(open) => {
          if (!open) setSelectedGrantId(null)
        }}
      >
        <MobileFriendlyDialogContent
          className={compactDialogContentClassName}
          drawerClassName={fullScreenDrawerContentClassName}
          drawerShowHandle={false}
        >
          {selectedGrant ? (
            <>
              <MobileFriendlyDialogHeader className={compactDialogHeaderClassName}>
                <MobileFriendlyDialogTitle>Application details</MobileFriendlyDialogTitle>
                <MobileFriendlyDialogDescription>
                  Manage the OAuth grant for {selectedGrant.clientName}.
                </MobileFriendlyDialogDescription>
              </MobileFriendlyDialogHeader>

              <div className={`${compactDialogBodyClassName} grid gap-3`}>
                <SettingsDialogDetailRow
                  label="Application"
                  title={selectedGrant.clientName}
                  value={selectedGrant.clientName}
                />
                <SettingsDialogDetailRow
                  label="Client ID"
                  title={selectedGrant.clientId}
                  value={selectedGrant.clientId}
                />
                <SettingsDialogDetailRow
                  label="Workspace"
                  title={selectedGrant.workspaceSlug}
                  value={selectedGrant.workspaceSlug}
                />
                <SettingsDialogDetailRow
                  label="Acts as"
                  title={formatActor(resolveGrantPrincipal({ grant: selectedGrant, principals }))}
                  value={formatActor(resolveGrantPrincipal({ grant: selectedGrant, principals }))}
                />
                <SettingsDialogDetailRow
                  label="Resource"
                  title={selectedGrant.resource}
                  value={selectedGrant.resource}
                />
                <SettingsDialogDetailRow
                  label="Created"
                  title={formatDate(selectedGrant.createdAt)}
                  value={formatDate(selectedGrant.createdAt)}
                />
                <SettingsDialogDetailRow
                  label="Last used"
                  title={selectedGrant.lastUsedAt ? formatDate(selectedGrant.lastUsedAt) : "Never"}
                  value={selectedGrant.lastUsedAt ? formatDate(selectedGrant.lastUsedAt) : "Never"}
                />

                <OAuthPermissionGrantList
                  canGrantAdminScope={canGrantAdminScope}
                  disabled={isMutating}
                  grantScopes={selectedGrant.scope}
                  selectedScopes={selectedScopes}
                  setSelectedScopes={setSelectedScopes}
                />
              </div>

              <MobileFriendlyDialogFooter
                className={`${compactDialogFooterClassName} gap-2 sm:justify-between`}
              >
                <Button
                  disabled={isMutating}
                  onClick={revokeSelectedGrant}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  Revoke access
                </Button>
                <Button
                  disabled={isMutating || scopesEqual(selectedGrant.scope, selectedScopes)}
                  onClick={updateScopes}
                  size="sm"
                  type="button"
                >
                  Save permissions
                </Button>
              </MobileFriendlyDialogFooter>
            </>
          ) : null}
        </MobileFriendlyDialogContent>
      </MobileFriendlyDialog>
    </SettingsSection>
  )
}

function OAuthPermissionGrantList({
  canGrantAdminScope,
  disabled,
  grantScopes,
  selectedScopes,
  setSelectedScopes,
}: {
  canGrantAdminScope: boolean
  disabled: boolean
  grantScopes: OAuthScope[]
  selectedScopes: OAuthScope[]
  setSelectedScopes: (updater: (current: OAuthScope[]) => OAuthScope[]) => void
}) {
  const visibleConfigurableScopes = configurableScopes.filter(
    (scope) =>
      scope.value !== "contextbase:manage" ||
      canGrantAdminScope ||
      selectedScopes.includes("contextbase:manage"),
  )

  return (
    <div className="grid gap-3 pt-1">
      <div className="text-sm font-medium">Permissions</div>
      <div className="grid gap-3">
        {visibleConfigurableScopes.map((scope) => (
          <label className="flex items-center gap-3 text-sm" key={scope.value}>
            <input
              checked={selectedScopes.includes(scope.value)}
              className="size-5 accent-primary"
              disabled={
                disabled ||
                !grantScopes.includes(scope.value) ||
                (scope.value === "contextbase:manage" && !canGrantAdminScope)
              }
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setSelectedScopes((current) =>
                  checked
                    ? [...current, scope.value]
                    : current.filter((value) => value !== scope.value),
                )
              }}
              type="checkbox"
            />
            <span className="truncate text-sm">{scope.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function resolveGrantPrincipal({
  grant,
  principals,
}: {
  grant: Pick<OAuthGrantSettingsItem, "actorId" | "actorKind">
  principals: SettingsPrincipal[]
}): SettingsPrincipal {
  const principal = principals.find(
    (candidate) => candidate.kind === grant.actorKind && candidate.id === grant.actorId,
  )
  if (principal) return principal

  return {
    displayName: grant.actorKind === "agent" ? grant.actorId : "You",
    id: grant.actorId,
    kind: grant.actorKind,
  }
}

function formatActor(principal: Pick<SettingsPrincipal, "displayName" | "kind">) {
  return principal.kind === "agent" ? `Agent ${principal.displayName}` : principal.displayName
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString()
}

function scopesEqual(left: OAuthScope[], right: OAuthScope[]) {
  const leftSet = new Set(left.filter((scope) => scope !== "offline_access"))
  const rightSet = new Set(right.filter((scope) => scope !== "offline_access"))
  if (leftSet.size !== rightSet.size) return false
  return [...leftSet].every((scope) => rightSet.has(scope))
}
