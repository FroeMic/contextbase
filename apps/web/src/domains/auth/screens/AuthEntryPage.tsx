import { useEffect, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { PostHogBrowserIdentity } from "../../analytics/PostHogBrowserIdentity"
import { resetPostHogBrowserSession } from "../../analytics/posthog-client"
import { type AuthSession, fetchCurrentSession, logout, switchWorkspace } from "../client/auth-api"
import { selectLoginSingleWorkspaceRedirect } from "../client/auth-entry"
import {
  rememberWorkspaceSelection,
  selectOAuthContinuationRedirect,
  selectWorkspaceRedirect,
} from "../client/redirect"

export function AuthEntryPage({
  autoForwardSingleBusiness,
  className,
  initialSession,
}: {
  autoForwardSingleBusiness: boolean
  className?: string
  initialSession?: AuthSession | null
}) {
  const [session, setSession] = useState<AuthSession | null>(initialSession ?? null)
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    if (initialSession) {
      const singleWorkspaceRedirect = autoForwardSingleBusiness
        ? selectLoginSingleWorkspaceRedirect(initialSession)
        : null
      if (singleWorkspaceRedirect) {
        window.location.assign(singleWorkspaceRedirect)
      }
      return
    }

    let isMounted = true

    async function loadSession() {
      try {
        const response = await fetchCurrentSession()
        if (!isMounted) return

        const singleWorkspaceRedirect = autoForwardSingleBusiness
          ? selectLoginSingleWorkspaceRedirect(response.data)
          : null
        if (singleWorkspaceRedirect) {
          window.location.assign(singleWorkspaceRedirect)
          return
        }

        setSession(response.data)
      } catch {
        if (isMounted) setIsAnonymous(true)
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [autoForwardSingleBusiness, initialSession])

  if (isAnonymous || !session) return null

  const selector = (
    <>
      <PostHogBrowserIdentity session={session} />
      <AuthEntrySelector session={session} />
    </>
  )
  return className ? <div className={className}>{selector}</div> : selector
}

export function AuthEntrySelector({
  redirectTo,
  session,
}: {
  redirectTo?: string
  session: AuthSession
}) {
  const [error, setError] = useState<string | null>(null)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const oauthContinuationRedirect = selectOAuthContinuationRedirect(redirectTo)

  async function chooseWorkspace(workspaceId: string) {
    setError(null)
    setPendingWorkspaceId(workspaceId)

    try {
      await switchWorkspace(workspaceId)
      rememberWorkspaceSelection({ workspaceId })
      if (oauthContinuationRedirect) {
        window.location.assign(oauthContinuationRedirect)
        return
      }
      const response = await fetchCurrentSession()
      window.location.assign(selectWorkspaceRedirect(response.data, redirectTo))
    } catch {
      setError("Unable to switch workspace.")
    } finally {
      setPendingWorkspaceId(null)
    }
  }

  async function logOut() {
    setError(null)
    setIsLoggingOut(true)

    try {
      await logout()
      resetPostHogBrowserSession()
      window.location.reload()
    } catch {
      setError("Unable to log out.")
      setIsLoggingOut(false)
    }
  }

  return (
    <Card className="w-full rounded-lg" size="sm">
      <CardHeader className="pb-2">
        <CardTitle level={2}>Choose workspace</CardTitle>
        <CardDescription>
          {oauthContinuationRedirect
            ? "Choose the workspace to authorize."
            : "Continue with an active workspace."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {session.workspaces.map((workspace) => (
            <Button
              className="h-auto w-full justify-between gap-3 rounded-lg px-3 py-2 text-left"
              disabled={pendingWorkspaceId !== null}
              key={workspace.workspaceId}
              onClick={() => void chooseWorkspace(workspace.workspaceId)}
              type="button"
              variant="outline"
            >
              <span className="min-w-0 truncate font-medium">{workspace.workspaceSlug}</span>
              <span aria-live="polite" className="shrink-0 text-muted-foreground">
                {pendingWorkspaceId === workspace.workspaceId ? "Switching..." : workspace.role}
              </span>
            </Button>
          ))}
        </div>
        {error ? (
          <p aria-live="polite" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="min-w-0 truncate">Signed in as {session.email}</span>
          <Button
            disabled={isLoggingOut}
            onClick={() => void logOut()}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
