import { Link, useLocation } from "@tanstack/react-router"

import { Button } from "@/shared/ui/button"

import { AuthApiError } from "../client/auth-api"

type AuthenticatedRouteErrorPageProps = {
  error: unknown
}

export function AuthenticatedRouteErrorPage({ error }: AuthenticatedRouteErrorPageProps) {
  const location = useLocation()
  const currentPath = `${location.pathname}${location.searchStr}`
  const loginSearch = { redirect_to: currentPath }
  const copy = getAuthenticatedRouteErrorCopy(error)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <section className="flex w-full max-w-md flex-col items-start gap-6 rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <a className="text-sm font-semibold tracking-tight text-foreground" href="/">
          Contextbase
        </a>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{copy.eyebrow}</p>
          <h1 className="text-balance text-3xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-balance text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button nativeButton={false} render={<Link search={loginSearch} to="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link to="/" />} variant="outline">
            Go home
          </Button>
        </div>
      </section>
    </main>
  )
}

export function getAuthenticatedRouteErrorCopy(error: unknown) {
  if (isUnauthenticatedError(error)) {
    return {
      description:
        "This link may be valid, but Contextbase needs your session before it can open workspace content.",
      eyebrow: "Login required",
      title: "Sign in to open this link",
    }
  }

  if (isWorkspaceSwitchError(error)) {
    return {
      description:
        "This link belongs to another workspace. Sign in or choose the matching workspace to continue.",
      eyebrow: "Workspace switch required",
      title: "Open this link from the right workspace",
    }
  }

  return {
    description:
      "The page either does not exist, or your current account does not have access to it. Signing in with another account may help.",
    eyebrow: "404",
    title: "We could not open that link",
  }
}

function isWorkspaceSwitchError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const maybeError = error as { reason?: unknown }
  return maybeError.reason === "switch"
}

function isUnauthenticatedError(error: unknown) {
  if (error instanceof AuthApiError) {
    return error.status === 401 || error.code === "unauthenticated"
  }

  if (!error || typeof error !== "object") return false

  const maybeError = error as { code?: unknown; status?: unknown }
  return maybeError.status === 401 || maybeError.code === "unauthenticated"
}
