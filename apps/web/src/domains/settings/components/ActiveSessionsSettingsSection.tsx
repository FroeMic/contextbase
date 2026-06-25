import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "../../../shared/ui/button"
import { Skeleton } from "../../../shared/ui/skeleton"
import { trpc } from "../../../trpc/react"
import {
  securitySessionsSettingsQueryOptions,
  settingsQueryKeys,
} from "../client/settings-query-options"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "./SettingsLayout"

type ActiveSessionItem = {
  current: boolean
  expiresAt: Date | string
  id: string
  userAgent: string | null
}

export function ActiveSessionsSettingsSection() {
  const sessionsQuery = useQuery(securitySessionsSettingsQueryOptions())
  const revokeMutation = trpc.settings.security.revokeOtherSessions.useMutation()
  const queryClient = useQueryClient()
  const [sectionError, setSectionError] = useState("")

  async function revokeOtherSessions() {
    if (revokeMutation.isPending) return
    setSectionError("")

    try {
      await revokeMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.securitySessions() })
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : "Unable to revoke sessions.")
    }
  }

  return (
    <SettingsSection>
      <SettingsSectionTitle>Active sessions</SettingsSectionTitle>
      <SettingsCard>
        {sessionsQuery.isPending ? (
          <SettingsRow>
            <SettingsRowLabel>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
            </SettingsRowLabel>
          </SettingsRow>
        ) : (
          sessionsQuery.data?.map((session) => (
            <ActiveSessionRow key={session.id} session={session} />
          ))
        )}
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowTitle>Other sessions</SettingsRowTitle>
            <SettingsRowDescription>Sign out browsers other than this one.</SettingsRowDescription>
            {sectionError || sessionsQuery.error?.message ? (
              <SettingsRowDescription className="text-destructive">
                {sectionError || sessionsQuery.error?.message}
              </SettingsRowDescription>
            ) : null}
          </SettingsRowLabel>
          <Button
            disabled={revokeMutation.isPending}
            onClick={revokeOtherSessions}
            size="sm"
            type="button"
            variant="outline"
          >
            Revoke others
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  )
}

function ActiveSessionRow({ session }: { session: ActiveSessionItem }) {
  const revokeSessionMutation = trpc.settings.security.revokeSession.useMutation()
  const queryClient = useQueryClient()
  const [rowError, setRowError] = useState("")

  async function revokeSession() {
    if (revokeSessionMutation.isPending) return
    setRowError("")

    try {
      await revokeSessionMutation.mutateAsync({ sessionId: session.id })
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.securitySessions() })
    } catch (error) {
      setRowError(error instanceof Error ? error.message : "Unable to revoke this session.")
    }
  }

  return (
    <SettingsRow className="group">
      <SettingsRowLabel>
        <SettingsRowTitle>
          {session.current ? "Current session" : "Browser session"}
        </SettingsRowTitle>
        <SettingsRowDescription>
          {session.userAgent ?? "Unknown browser"} · Expires{" "}
          {new Date(session.expiresAt).toLocaleDateString()}
        </SettingsRowDescription>
        {rowError ? (
          <SettingsRowDescription className="text-destructive">{rowError}</SettingsRowDescription>
        ) : null}
      </SettingsRowLabel>
      {session.current ? (
        <span className="text-sm text-muted-foreground">Active now</span>
      ) : (
        <Button
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          disabled={revokeSessionMutation.isPending}
          onClick={revokeSession}
          size="sm"
          type="button"
          variant="outline"
        >
          Revoke
        </Button>
      )}
    </SettingsRow>
  )
}
