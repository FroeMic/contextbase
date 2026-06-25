import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import { identifyPostHogBrowserSession } from "../../analytics/posthog-client"
import { type AuthSession, consumeMagicLink, fetchCurrentSession } from "../client/auth-api"
import { readWorkspaceSelectionPreference, selectPostLoginRedirect } from "../client/redirect"

export function VerifyPage({ redirectTo, token }: { redirectTo?: string; token?: string }) {
  const [error, setError] = useState<string | null>(null)
  const consumedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function verify() {
      if (!token) {
        setError("Missing sign-in token.")
        return
      }

      if (consumedTokenRef.current === token) return
      consumedTokenRef.current = token

      try {
        await consumeMagicLink(token)
      } catch {
        const session = await fetchCurrentSession().catch(() => null)
        if (session) {
          identifyPostHogBrowserSession(session.data)
          redirectAfterVerification(session.data, redirectTo)
          return
        }
        if (isMounted) setError("This sign-in link is invalid or expired.")
        return
      }

      try {
        const session = await fetchCurrentSession()
        identifyPostHogBrowserSession(session.data)
        redirectAfterVerification(session.data, redirectTo)
      } catch {
        if (isMounted) setError("This sign-in link is invalid or expired.")
      }
    }

    void verify()

    return () => {
      isMounted = false
    }
  }, [redirectTo, token])

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>{error ? "Sign-in failed" : "Signing in"}</CardTitle>
          <CardDescription aria-live="polite">
            {error ?? "Your browser session is being verified."}
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

function redirectAfterVerification(session: AuthSession, redirectTo: string | undefined) {
  window.location.assign(
    selectPostLoginRedirect(session, redirectTo, readWorkspaceSelectionPreference()),
  )
}
