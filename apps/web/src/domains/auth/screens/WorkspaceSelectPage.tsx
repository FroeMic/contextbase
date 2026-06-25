import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import { PostHogBrowserIdentity } from "../../analytics/PostHogBrowserIdentity"
import { type AuthSession, fetchCurrentSession, switchWorkspace } from "../client/auth-api"
import { rememberWorkspaceSelection, selectWorkspaceRedirect } from "../client/redirect"

export function WorkspaceSelectPage({ redirectTo }: { redirectTo?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      try {
        const response = await fetchCurrentSession()
        if (!isMounted) return

        if (response.data.workspaces.length === 1) {
          window.location.assign(selectWorkspaceRedirect(response.data, redirectTo))
          return
        }

        setSession(response.data)
      } catch {
        window.location.assign(`/login?redirect_to=${encodeURIComponent(redirectTo ?? "/")}`)
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [redirectTo])

  async function chooseWorkspace(workspaceId: string) {
    setError(null)
    setPendingWorkspaceId(workspaceId)

    try {
      await switchWorkspace(workspaceId)
      rememberWorkspaceSelection({ workspaceId })
      const response = await fetchCurrentSession()
      window.location.assign(selectWorkspaceRedirect(response.data, redirectTo))
    } catch {
      setError("Unable to switch workspace.")
    } finally {
      setPendingWorkspaceId(null)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <PostHogBrowserIdentity session={session} />
      <Card className="w-full max-w-md rounded-lg" size="sm">
        <CardHeader>
          <CardTitle level={1}>Choose workspace</CardTitle>
          <CardDescription>Continue with an active workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {(session?.workspaces ?? []).map((workspace) => (
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
          <Button
            nativeButton={false}
            render={<Link search={{ redirect_to: undefined }} to="/login" />}
            size="sm"
            variant="link"
          >
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
