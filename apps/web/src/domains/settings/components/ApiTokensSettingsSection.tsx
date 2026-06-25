import { type FormEvent, useEffect, useMemo, useState } from "react"

import { Button } from "../../../shared/ui/button"
import { Input } from "../../../shared/ui/input"
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

export type ApiTokenScope =
  | "contextbase:read"
  | "contextbase:write"
  | "contextbase:files"
  | "contextbase:manage"

export type ApiTokenSettingsItem = {
  createdAt: Date | string
  createdByUserId: string | null
  id: string
  label: string
  lastUsedAt: Date | string | null
  principalId: string
  principalKind: string
  scope: ApiTokenScope[]
  updatedAt: Date | string
  workspaceSlug: string
}

export type ApiTokenAgentOption = {
  avatarUrl?: string | null
  displayName: string
  id: string
}

type ApiTokenCreateInput = {
  agentId?: string
  label: string
  scope: ApiTokenScope[]
}

type ApiTokensSettingsSectionProps = {
  agents?: ApiTokenAgentOption[]
  canGrantAdminScope?: boolean
  createLabel?: string
  emptyText: string
  isLoading: boolean
  isMutating: boolean
  onCreate?: (input: ApiTokenCreateInput) => Promise<{ rawToken: string }>
  onRevoke: (tokenId: string) => Promise<void>
  onUpdate: (input: { label: string; scope: ApiTokenScope[]; tokenId: string }) => Promise<void>
  principal?: SettingsPrincipal | null
  principals?: SettingsPrincipal[]
  requiresAgent?: boolean
  sectionDescription: string
  sectionTitle: string
  showRowScopeSummary?: boolean
  tokens: ApiTokenSettingsItem[]
}

const scopes = [
  { label: "Read Contextbase data", value: "contextbase:read" },
  { label: "Create and update data", value: "contextbase:write" },
  { label: "Use file links", value: "contextbase:files" },
  { label: "Manage workspace", value: "contextbase:manage" },
] as const

const compactDialogContentClassName =
  "flex max-h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
const fullScreenDrawerContentClassName =
  "h-[100dvh] max-h-[100dvh] rounded-none p-0 before:inset-0 before:rounded-none data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh]"
const compactDialogHeaderClassName = "px-5 pt-5 pb-4"
const compactDialogBodyClassName =
  "min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]"
const compactDialogFooterClassName = "border-t border-border px-5 py-4"

export function ApiTokensSettingsSection({
  agents = [],
  canGrantAdminScope = false,
  createLabel,
  emptyText,
  isLoading,
  isMutating,
  onCreate,
  onRevoke,
  onUpdate,
  principal,
  principals = [],
  requiresAgent = false,
  sectionDescription,
  sectionTitle,
  showRowScopeSummary = true,
  tokens,
}: ApiTokensSettingsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null)
  const [createName, setCreateName] = useState("")
  const [createAgentId, setCreateAgentId] = useState("")
  const [createScopes, setCreateScopes] = useState<ApiTokenScope[]>([
    "contextbase:read",
    "contextbase:write",
    "contextbase:files",
  ])
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const selectedToken = useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) ?? null,
    [selectedTokenId, tokens],
  )
  const [editName, setEditName] = useState("")
  const [editScopes, setEditScopes] = useState<ApiTokenScope[]>([])

  useEffect(() => {
    if (selectedToken) {
      setEditName(selectedToken.label)
      setEditScopes(selectedToken.scope)
    }
  }, [selectedToken])

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onCreate) return
    if (isMutating) return
    const result = await onCreate({
      ...(requiresAgent ? { agentId: createAgentId } : {}),
      label: createName,
      scope: createScopes,
    })
    setCreatedRawToken(result.rawToken)
  }

  async function saveSelectedToken() {
    if (!selectedToken) return
    await onUpdate({ label: editName, scope: editScopes, tokenId: selectedToken.id })
    setSelectedTokenId(null)
  }

  async function revokeSelectedToken() {
    if (!selectedToken) return
    const confirmed = window.confirm(`Revoke API key ${selectedToken.label}?`)
    if (!confirmed) return
    await onRevoke(selectedToken.id)
    setSelectedTokenId(null)
  }

  function resetCreateDialog(open: boolean) {
    setCreateOpen(open)
    if (!open) {
      setCreateName("")
      setCreateAgentId("")
      setCreateScopes(["contextbase:read", "contextbase:write", "contextbase:files"])
      setCreatedRawToken(null)
    }
  }

  return (
    <SettingsSection>
      <div className="flex items-center justify-between gap-4">
        <div>
          <SettingsSectionTitle>{sectionTitle}</SettingsSectionTitle>
          {sectionDescription ? (
            <SettingsSectionDescription>{sectionDescription}</SettingsSectionDescription>
          ) : null}
        </div>
        {onCreate && createLabel ? (
          <Button onClick={() => setCreateOpen(true)} size="sm" type="button" variant="outline">
            {createLabel}
          </Button>
        ) : null}
      </div>
      <SettingsCard>
        {isLoading ? (
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>Loading API keys</SettingsRowTitle>
            </SettingsRowLabel>
          </SettingsRow>
        ) : tokens.length === 0 ? (
          <SettingsRow>
            <SettingsRowDescription>{emptyText}</SettingsRowDescription>
          </SettingsRow>
        ) : (
          tokens.map((token) => {
            const tokenPrincipal = resolveTokenPrincipal({ agents, principal, principals, token })

            return (
              <button
                className="flex w-full items-center gap-3 px-5 py-5 text-left transition-colors hover:bg-muted/50"
                key={token.id}
                onClick={() => setSelectedTokenId(token.id)}
                type="button"
              >
                <PrincipalAvatar principal={tokenPrincipal} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{token.label}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {formatPrincipal(tokenPrincipal)} · {formatDate(token.createdAt)}
                  </span>
                </span>
                {showRowScopeSummary ? (
                  <span className="ml-auto hidden shrink-0 text-sm text-muted-foreground sm:block">
                    {formatScopeSummary(token.scope)}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
      </SettingsCard>

      <MobileFriendlyDialog open={createOpen} onOpenChange={resetCreateDialog}>
        <MobileFriendlyDialogContent
          className={compactDialogContentClassName}
          drawerClassName={fullScreenDrawerContentClassName}
          drawerShowHandle={false}
        >
          <MobileFriendlyDialogHeader className={compactDialogHeaderClassName}>
            <MobileFriendlyDialogTitle>Create API key</MobileFriendlyDialogTitle>
            <MobileFriendlyDialogDescription>
              The key value is shown once after creation.
            </MobileFriendlyDialogDescription>
          </MobileFriendlyDialogHeader>
          {createdRawToken ? (
            <div className={compactDialogBodyClassName}>
              <div className="text-sm font-medium">API key</div>
              <code className="mt-2 block break-all rounded-md border border-border bg-muted px-3 py-2 text-sm">
                {createdRawToken}
              </code>
              <p className="mt-2 text-sm text-muted-foreground">
                This API key will not be visible again.
              </p>
            </div>
          ) : (
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitCreate}>
              <div className={`${compactDialogBodyClassName} grid gap-4`}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor={`${sectionTitle}-token-name`}>
                    Key name
                  </label>
                  <Input
                    id={`${sectionTitle}-token-name`}
                    onChange={(event) => setCreateName(event.currentTarget.value)}
                    required
                    value={createName}
                  />
                </div>
                {requiresAgent ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor={`${sectionTitle}-agent`}>
                      Acting agent
                    </label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      id={`${sectionTitle}-agent`}
                      onChange={(event) => setCreateAgentId(event.currentTarget.value)}
                      required
                      value={createAgentId}
                    >
                      <option value="">Select agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <ScopeCheckboxes
                  canGrantAdminScope={canGrantAdminScope}
                  selected={createScopes}
                  setSelected={setCreateScopes}
                />
              </div>
              <MobileFriendlyDialogFooter className={compactDialogFooterClassName}>
                <Button disabled={isMutating} size="sm" type="submit">
                  Create
                </Button>
              </MobileFriendlyDialogFooter>
            </form>
          )}
        </MobileFriendlyDialogContent>
      </MobileFriendlyDialog>

      <MobileFriendlyDialog
        open={Boolean(selectedToken)}
        onOpenChange={(open) => {
          if (!open) setSelectedTokenId(null)
        }}
      >
        <MobileFriendlyDialogContent
          className={compactDialogContentClassName}
          drawerClassName={fullScreenDrawerContentClassName}
          drawerShowHandle={false}
        >
          {selectedToken ? (
            <>
              <MobileFriendlyDialogHeader className={compactDialogHeaderClassName}>
                <MobileFriendlyDialogTitle>API key details</MobileFriendlyDialogTitle>
                <MobileFriendlyDialogDescription>
                  Manage this API key and its grants.
                </MobileFriendlyDialogDescription>
              </MobileFriendlyDialogHeader>
              <div className={`${compactDialogBodyClassName} grid gap-3`}>
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor={`${selectedToken.id}-name`}>
                    Key name
                  </label>
                  <Input
                    id={`${selectedToken.id}-name`}
                    onChange={(event) => setEditName(event.currentTarget.value)}
                    value={editName}
                  />
                </div>
                <SettingsDialogDetailRow
                  label="Principal"
                  title={formatPrincipal(
                    resolveTokenPrincipal({ agents, principal, principals, token: selectedToken }),
                  )}
                  value={formatPrincipal(
                    resolveTokenPrincipal({ agents, principal, principals, token: selectedToken }),
                  )}
                />
                <SettingsDialogDetailRow
                  label="Workspace"
                  title={selectedToken.workspaceSlug}
                  value={selectedToken.workspaceSlug}
                />
                <SettingsDialogDetailRow
                  label="Created"
                  title={formatDate(selectedToken.createdAt)}
                  value={formatDate(selectedToken.createdAt)}
                />
                <SettingsDialogDetailRow
                  label="Last used"
                  title={selectedToken.lastUsedAt ? formatDate(selectedToken.lastUsedAt) : "Never"}
                  value={selectedToken.lastUsedAt ? formatDate(selectedToken.lastUsedAt) : "Never"}
                />
                <ScopeCheckboxes
                  canGrantAdminScope={canGrantAdminScope}
                  selected={editScopes}
                  setSelected={setEditScopes}
                />
              </div>
              <MobileFriendlyDialogFooter
                className={`${compactDialogFooterClassName} gap-2 sm:justify-between`}
              >
                <Button
                  disabled={isMutating}
                  onClick={revokeSelectedToken}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  Revoke API key
                </Button>
                <Button disabled={isMutating} onClick={saveSelectedToken} size="sm" type="button">
                  Save changes
                </Button>
              </MobileFriendlyDialogFooter>
            </>
          ) : null}
        </MobileFriendlyDialogContent>
      </MobileFriendlyDialog>
    </SettingsSection>
  )
}

function ScopeCheckboxes({
  canGrantAdminScope,
  selected,
  setSelected,
}: {
  canGrantAdminScope: boolean
  selected: ApiTokenScope[]
  setSelected: (scopes: ApiTokenScope[]) => void
}) {
  const visibleScopes = scopes.filter(
    (scope) =>
      scope.value !== "contextbase:manage" ||
      canGrantAdminScope ||
      selected.includes("contextbase:manage"),
  )

  return (
    <div className="grid gap-3">
      <div className="text-sm font-medium">Permissions</div>
      <div className="grid gap-2">
        {visibleScopes.map((scope) => (
          <label className="flex items-center gap-3 text-sm" key={scope.value}>
            <input
              checked={selected.includes(scope.value)}
              className="size-4 accent-primary"
              disabled={scope.value === "contextbase:manage" && !canGrantAdminScope}
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setSelected(
                  checked
                    ? [...selected, scope.value]
                    : selected.filter((value) => value !== scope.value),
                )
              }}
              type="checkbox"
            />
            {scope.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function resolveTokenPrincipal({
  agents,
  principal,
  principals,
  token,
}: {
  agents: ApiTokenAgentOption[]
  principal?: SettingsPrincipal | null
  principals: SettingsPrincipal[]
  token: Pick<ApiTokenSettingsItem, "principalId" | "principalKind">
}): SettingsPrincipal {
  if (token.principalKind === "agent") {
    const agent = agents.find((candidate) => candidate.id === token.principalId)
    return {
      avatarUrl: agent?.avatarUrl,
      displayName: agent?.displayName ?? token.principalId,
      id: token.principalId,
      kind: "agent",
    }
  }

  const knownPrincipal = principals.find(
    (candidate) => candidate.kind === token.principalKind && candidate.id === token.principalId,
  )
  if (knownPrincipal) return knownPrincipal

  if (principal && principal.id === token.principalId) return principal

  return {
    displayName: principal?.displayName ?? "You",
    id: token.principalId,
    kind: token.principalKind,
  }
}

function formatPrincipal(principal: Pick<SettingsPrincipal, "displayName" | "kind">) {
  return principal.kind === "agent" ? `Agent ${principal.displayName}` : principal.displayName
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString()
}

function formatScopeSummary(scope: ApiTokenScope[]) {
  const labels = scopes.filter((item) => scope.includes(item.value)).map((item) => item.label)
  return labels.length > 0 ? labels.join(", ") : "No active permissions"
}
