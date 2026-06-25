import { Link } from "@tanstack/react-router"
import type * as React from "react"
import { useId, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

import { PostHogBrowserIdentity } from "../../analytics/PostHogBrowserIdentity"
import { identifyPostHogBrowserSession } from "../../analytics/posthog-client"
import {
  AuthApiError,
  type AuthSession,
  fetchCurrentSession,
  loginWithPassword,
  requestMagicLink,
  requestSignupVerification,
} from "../client/auth-api"
import { detectMagicLinkClientKind } from "../client/desktop-auth"
import { readWorkspaceSelectionPreference, selectPostLoginRedirect } from "../client/redirect"
import { DotsShader } from "../components/DotsShader"
import { AuthEntrySelector } from "./AuthEntryPage"

export function LoginPage({
  initialMode = "magic-link",
  redirectTo,
  session,
}: {
  initialMode?: "magic-link" | "password" | "signup"
  redirectTo?: string
  session?: AuthSession | null
}) {
  const [loginMode, setLoginMode] = useState<"magic-link" | "password" | "signup">(initialMode)

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <PostHogBrowserIdentity session={session} />
      <section className="flex min-h-dvh flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a className="flex items-center gap-2 font-medium" href="/">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Contextbase
            </span>
          </a>
        </div>
        <div className="flex flex-1 items-start justify-center pt-20 md:pt-24 lg:pt-28">
          <div className="w-full max-w-sm">
            {session ? (
              <AuthEntrySelector redirectTo={redirectTo} session={session} />
            ) : loginMode === "password" ? (
              <PasswordLoginForm
                onSwitchToMagicLink={() => setLoginMode("magic-link")}
                redirectTo={redirectTo}
              />
            ) : loginMode === "signup" ? (
              <SignupForm />
            ) : (
              <MagicLinkForm
                onSwitchToPassword={() => setLoginMode("password")}
                redirectTo={redirectTo}
              />
            )}
          </div>
        </div>
      </section>
      <section className="relative hidden min-h-dvh overflow-hidden bg-black lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(252,109,38,0.18),transparent_32%),linear-gradient(135deg,#050505,#000)]" />
        <DotsShader
          colors={[
            [226, 67, 41],
            [252, 109, 38],
            [252, 163, 38],
          ]}
          dotSize={1}
          opacities={[0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.8, 0.8, 0.8, 1]}
          totalSize={5}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-background/10 via-transparent to-background/20" />
      </section>
    </main>
  )
}

function MagicLinkForm({
  onSwitchToPassword,
  redirectTo,
}: {
  onSwitchToPassword: () => void
  redirectTo?: string
}) {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSent, setIsSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await requestMagicLink({ clientKind: await detectMagicLinkClientKind(), email, redirectTo })
      setIsSent(true)
    } catch (error) {
      setError(error instanceof AuthApiError ? error.message : "Unable to send a magic link.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="mx-auto flex w-full max-w-xs flex-col gap-6" onSubmit={submit}>
      <div className="flex flex-col items-start gap-1 text-left">
        <h1 className="text-2xl font-bold">Sign in to Contextbase</h1>
        {isSent ? (
          <p aria-live="polite" className="text-balance text-sm text-muted-foreground">
            Check your inbox for the sign-in link.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Send magic link"}
      </Button>
      <Button
        className="h-auto self-center px-0 text-xs text-muted-foreground"
        onClick={onSwitchToPassword}
        size="sm"
        type="button"
        variant="link"
      >
        Login with e-mail and password instead
      </Button>
      <Button
        className="h-auto self-center px-0 text-xs text-muted-foreground"
        nativeButton={false}
        render={<Link to="/create" />}
        size="sm"
        variant="link"
      >
        Create an account
      </Button>
    </form>
  )
}

function SignupForm() {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSent, setIsSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await requestSignupVerification({ email })
      setIsSent(true)
    } catch (error) {
      setError(error instanceof AuthApiError ? error.message : "Unable to start signup.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="mx-auto flex w-full max-w-xs flex-col gap-6" onSubmit={submit}>
      <div className="flex flex-col items-start gap-1 text-left">
        <h1 className="text-2xl font-bold">Create an account</h1>
        {isSent ? (
          <p aria-live="polite" className="text-balance text-sm text-muted-foreground">
            Check your inbox to verify your email.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          autoComplete="email"
          id={emailId}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          readOnly={isSent || isSubmitting}
          required
          type="email"
          value={email}
        />
      </div>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Continue"}
      </Button>
      <Button
        className="h-auto self-center px-0 text-xs text-muted-foreground"
        nativeButton={false}
        render={<Link search={{ redirect_to: undefined }} to="/login" />}
        size="sm"
        variant="link"
      >
        Already have an account?
      </Button>
    </form>
  )
}

function PasswordLoginForm({
  onSwitchToMagicLink,
  redirectTo,
}: {
  onSwitchToMagicLink: () => void
  redirectTo?: string
}) {
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await loginWithPassword({ email, password })
      const session = await fetchCurrentSession()
      identifyPostHogBrowserSession(session.data)
      window.location.assign(
        selectPostLoginRedirect(session.data, redirectTo, readWorkspaceSelectionPreference()),
      )
    } catch (error) {
      setError(error instanceof AuthApiError ? error.message : "Unable to sign in.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="mx-auto flex w-full max-w-xs flex-col gap-6" onSubmit={submit}>
      <div className="flex flex-col items-start gap-1 text-left">
        <h1 className="text-2xl font-bold">Sign in to Contextbase</h1>
        <p aria-live="polite" className="text-balance text-sm text-muted-foreground">
          Use a magic link if this account does not have a password yet.
        </p>
      </div>
      <div className="grid gap-3">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          autoComplete="email"
          id={emailId}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      <div className="grid gap-3">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          autoComplete="current-password"
          id={passwordId}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
      <Button
        className="h-auto self-center px-0 text-xs text-muted-foreground"
        onClick={onSwitchToMagicLink}
        size="sm"
        type="button"
        variant="link"
      >
        Use magic link instead
      </Button>
    </form>
  )
}
