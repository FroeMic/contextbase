import { Mail, Plus, RotateCcw, X } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "../../../shared/ui/avatar"
import { Badge } from "../../../shared/ui/badge"
import { Button } from "../../../shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { NativeSelect, NativeSelectOption } from "../../../shared/ui/native-select"
import { trpc } from "../../../trpc/react"
import { useSession } from "../../auth/client/use-session"
import { buildPublicAvatarUrl } from "../client/public-avatar-url"
import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsSection,
  SettingsSectionTitle,
} from "../components/SettingsLayout"

type WorkspaceInvitationRole = "workspace_admin" | "workspace_member"

type WorkspaceMemberRow = {
  displayName?: string | null
  email?: string | null
  id: string
  principalId: string
  principalKind?: string | null
  role?: string | null
  status?: string | null
  user?: { avatarFileObject?: Parameters<typeof buildPublicAvatarUrl>[0] } | null
}

type WorkspaceInvitationRow = {
  acceptedAt?: Date | string | null
  email: string
  expiresAt: Date | string
  id: string
  revokedAt?: Date | string | null
  role: WorkspaceInvitationRole
  status: string
}

export function WorkspaceMembersSettingsPage() {
  const session = useSession()
  const isWorkspaceAdmin = session.data
    ? canAdminWorkspaceRole(session.data.activeWorkspaceRole)
    : false
  const membersQuery = trpc.settings.members.list.useQuery(undefined, {
    enabled: isWorkspaceAdmin,
  })
  const invitationsQuery = trpc.settings.invitations.list.useQuery(undefined, {
    enabled: isWorkspaceAdmin,
  })
  const memberRows = useMemo(
    () => (membersQuery.data?.members ?? []) as WorkspaceMemberRow[],
    [membersQuery.data?.members],
  )
  const invitationRows = (invitationsQuery.data?.invitations ?? []) as WorkspaceInvitationRow[]

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <SettingsPageTitle>Members</SettingsPageTitle>
          {isWorkspaceAdmin ? <InviteMemberDialog /> : null}
        </div>

        {!isWorkspaceAdmin ? (
          <WorkspaceMembersAccessRequired />
        ) : (
          <>
            <SettingsSection>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <SettingsSectionTitle>Workspace members</SettingsSectionTitle>
                  <SettingsRowDescription>
                    Review the people who can access this workspace.
                  </SettingsRowDescription>
                </div>
              </div>
              <SettingsCard>
                {membersQuery.isPending ? (
                  <SettingsRow>
                    <SettingsRowDescription>Loading members...</SettingsRowDescription>
                  </SettingsRow>
                ) : memberRows.length === 0 ? (
                  <SettingsRow>
                    <SettingsRowDescription>No workspace members found.</SettingsRowDescription>
                  </SettingsRow>
                ) : (
                  memberRows.map((member) => (
                    <WorkspaceMemberSettingsRow key={member.principalId} member={member} />
                  ))
                )}
              </SettingsCard>
            </SettingsSection>

            <SettingsSection>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <SettingsSectionTitle>Pending invitations</SettingsSectionTitle>
                  <SettingsRowDescription>
                    Invite new users and revoke invitations that should no longer be accepted.
                  </SettingsRowDescription>
                </div>
              </div>
              <SettingsCard>
                {invitationsQuery.isPending ? (
                  <SettingsRow>
                    <SettingsRowDescription>Loading invitations...</SettingsRowDescription>
                  </SettingsRow>
                ) : invitationRows.length === 0 ? (
                  <SettingsRow>
                    <SettingsRowDescription>No invitations created yet.</SettingsRowDescription>
                  </SettingsRow>
                ) : (
                  invitationRows.map((invitation) => (
                    <WorkspaceInvitationSettingsRow invitation={invitation} key={invitation.id} />
                  ))
                )}
              </SettingsCard>
            </SettingsSection>
          </>
        )}
      </SettingsPageContent>
    </SettingsPage>
  )
}

function InviteMemberDialog() {
  const trpcUtils = trpc.useUtils()
  const createInvitationMutation = trpc.settings.invitations.create.useMutation()
  const emailId = useId()
  const roleId = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<WorkspaceInvitationRole>("workspace_member")
  const [formError, setFormError] = useState("")

  async function inviteMember() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || createInvitationMutation.isPending) return

    setFormError("")
    try {
      await createInvitationMutation.mutateAsync({ email: trimmedEmail, role })
      await trpcUtils.settings.invitations.list.invalidate()
      setEmail("")
      setRole("workspace_member")
      setOpen(false)
      toast.success("Invitation sent.")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to invite member.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm" type="button">
        <Plus className="size-4" />
        Invite member
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor={emailId}>
              Email
            </label>
            <Input
              autoComplete="email"
              id={emailId}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor={roleId}>
              Role
            </label>
            <NativeSelect
              id={roleId}
              onChange={(event) => setRole(event.target.value as WorkspaceInvitationRole)}
              value={role}
            >
              <NativeSelectOption value="workspace_member">Member</NativeSelectOption>
              <NativeSelectOption value="workspace_admin">Admin</NativeSelectOption>
            </NativeSelect>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button
            disabled={!email.trim() || createInvitationMutation.isPending}
            onClick={inviteMember}
            type="button"
          >
            Invite member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkspaceMemberSettingsRow({ member }: { member: WorkspaceMemberRow }) {
  const trpcUtils = trpc.useUtils()
  const updateMemberMutation = trpc.settings.members.update.useMutation()
  const disableMemberMutation = trpc.settings.members.disable.useMutation()
  const reactivateMemberMutation = trpc.settings.members.reactivate.useMutation()
  const avatarUrl = buildPublicAvatarUrl(member.user?.avatarFileObject)
  const displayName = member.displayName ?? member.email ?? member.principalId
  const email = member.email
  const isDisabled = member.status === "disabled"
  const isMutating =
    updateMemberMutation.isPending ||
    disableMemberMutation.isPending ||
    reactivateMemberMutation.isPending

  async function updateRole(role: WorkspaceInvitationRole) {
    if (role === member.role || isMutating) return

    try {
      await updateMemberMutation.mutateAsync({ membershipId: member.id, role })
      await trpcUtils.settings.members.list.invalidate()
      toast.success("Member role updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update member role.")
    }
  }

  async function toggleStatus() {
    if (isMutating) return

    try {
      if (isDisabled) {
        await reactivateMemberMutation.mutateAsync({ membershipId: member.id })
        toast.success("Member reactivated.")
      } else {
        await disableMemberMutation.mutateAsync({ membershipId: member.id })
        toast.success("Member disabled.")
      }
      await trpcUtils.settings.members.list.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update member status.")
    }
  }

  return (
    <SettingsRow className="items-center">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
          <AvatarFallback>{memberInitial(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {email ? <div className="truncate text-sm text-muted-foreground">{email}</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <NativeSelect
          aria-label={`Role for ${displayName}`}
          disabled={isMutating}
          onChange={(event) => updateRole(event.target.value as WorkspaceInvitationRole)}
          value={member.role === "workspace_admin" ? "workspace_admin" : "workspace_member"}
        >
          <NativeSelectOption value="workspace_member">Member</NativeSelectOption>
          <NativeSelectOption value="workspace_admin">Admin</NativeSelectOption>
        </NativeSelect>
        {member.status && member.status !== "active" ? (
          <Badge variant="secondary">{member.status}</Badge>
        ) : null}
        <Button
          aria-label={isDisabled ? `Reactivate ${displayName}` : `Disable ${displayName}`}
          disabled={isMutating}
          onClick={toggleStatus}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {isDisabled ? <RotateCcw className="size-4" /> : <X className="size-4" />}
        </Button>
      </div>
    </SettingsRow>
  )
}

function WorkspaceInvitationSettingsRow({ invitation }: { invitation: WorkspaceInvitationRow }) {
  const trpcUtils = trpc.useUtils()
  const revokeInvitationMutation = trpc.settings.invitations.revoke.useMutation()
  const canRevoke =
    invitation.status === "pending" && !invitation.acceptedAt && !invitation.revokedAt

  async function revokeInvitation() {
    if (!canRevoke || revokeInvitationMutation.isPending) return

    try {
      await revokeInvitationMutation.mutateAsync({ invitationId: invitation.id })
      await trpcUtils.settings.invitations.list.invalidate()
      toast.success("Invitation revoked.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revoke invitation.")
    }
  }

  return (
    <SettingsRow className="items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
          <Mail className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{invitation.email}</div>
          <div className="truncate text-sm text-muted-foreground">
            Expires {formatDate(invitation.expiresAt)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canRevoke ? (
          <Button
            aria-label={`Revoke invitation for ${invitation.email}`}
            disabled={revokeInvitationMutation.isPending}
            onClick={revokeInvitation}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </SettingsRow>
  )
}

function WorkspaceMembersAccessRequired() {
  return (
    <SettingsSection>
      <SettingsCard>
        <SettingsRow>
          <SettingsRowDescription>
            Workspace admin access required to manage members.
          </SettingsRowDescription>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  )
}

function canAdminWorkspaceRole(role: string) {
  return role === "workspace_admin"
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function memberInitial(label: string) {
  return label.trim().match(/\p{L}/u)?.[0]?.toUpperCase() ?? "U"
}
