import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import { identifyPostHogBrowserSession } from "../../analytics/posthog-client"
import {
  type AuthSession,
  acceptWorkspaceInvitation,
  fetchCurrentSession,
} from "../client/auth-api"
import { readWorkspaceSelectionPreference, selectPostLoginRedirect } from "../client/redirect"

export function InvitationAcceptPage({ token }: { token?: string }) {
  const [error, setError] = useState<string | null>(null)
  const consumedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function acceptInvitation() {
      if (!token) {
        setError("Missing invitation token.")
        return
      }

      if (consumedTokenRef.current === token) return
      consumedTokenRef.current = token

      let invitationAccepted = false
      try {
        await acceptWorkspaceInvitation(token)
        invitationAccepted = true
        const session = await fetchCurrentSession()
        identifyPostHogBrowserSession(session.data)
        redirectAfterInvitationAcceptance(session.data)
      } catch {
        if (!invitationAccepted) {
          if (isMounted) setError("This invitation link is invalid or expired.")
          return
        }

        const session = await fetchCurrentSession().catch(() => null)
        if (session) {
          identifyPostHogBrowserSession(session.data)
          redirectAfterInvitationAcceptance(session.data)
          return
        }
        if (isMounted) setError("This invitation link is invalid or expired.")
      }
    }

    void acceptInvitation()

    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>{error ? "Invitation failed" : "Accepting invitation"}</CardTitle>
          <CardDescription aria-live="polite">
            {error ?? "Your workspace invitation is being verified."}
          </CardDescription>
        </CardHeader>
        {error ? (
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link search={{ redirect_to: undefined }} to="/login" />}
              size="sm"
              variant="link"
            >
              Back to sign in
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </main>
  )
}

function redirectAfterInvitationAcceptance(session: AuthSession) {
  window.location.assign(
    selectPostLoginRedirect(session, undefined, readWorkspaceSelectionPreference()),
  )
}
