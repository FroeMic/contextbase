import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import { consumeSignupVerification } from "../client/auth-api"

export function SignupVerifyPage({ token }: { token?: string }) {
  const [error, setError] = useState<string | null>(null)
  const consumedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function verify() {
      if (!token) {
        setError("Missing signup token.")
        return
      }

      if (consumedTokenRef.current === token) return
      consumedTokenRef.current = token

      try {
        await consumeSignupVerification(token)
        window.location.assign("/create")
      } catch {
        if (isMounted) setError("This signup link is invalid or expired.")
      }
    }

    void verify()

    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>{error ? "Signup verification failed" : "Verifying email"}</CardTitle>
          <CardDescription aria-live="polite">
            {error ?? "Your email is being verified."}
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
