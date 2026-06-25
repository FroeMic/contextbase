import type { AuthSession } from "./auth-api"

export type WorkspaceSelectionPreference = {
  lastWorkspaceId: string | null
}

type SelectionStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const lastWorkspaceKey = "contextbase:lastWorkspaceId"

export function selectPostLoginRedirect(
  session: AuthSession,
  redirectTo: string | null | undefined,
  preference: WorkspaceSelectionPreference | null = null,
): string {
  const safeRedirect = sanitizeRedirect(redirectTo)

  if (safeRedirect && isOAuthContinuationRedirect(safeRedirect)) {
    return safeRedirect
  }

  if (safeRedirect && targetsAccessibleWorkspace(session, safeRedirect)) {
    return safeRedirect
  }

  const rememberedRedirect = selectRememberedWorkspaceRedirect(session, preference)
  if (rememberedRedirect) {
    return rememberedRedirect
  }

  if (session.workspaces.length > 1) {
    const params = safeRedirect ? `?redirect_to=${encodeURIComponent(safeRedirect)}` : ""
    return `/workspaces/select${params}`
  }

  return selectWorkspaceRedirect(session, safeRedirect)
}

export function selectWorkspaceRedirect(
  session: AuthSession,
  redirectTo: string | null | undefined,
): string {
  const safeRedirect = sanitizeRedirect(redirectTo)

  if (safeRedirect && isOAuthContinuationRedirect(safeRedirect)) {
    return safeRedirect
  }

  if (safeRedirect && targetsAccessibleWorkspace(session, safeRedirect)) {
    return safeRedirect
  }

  const activeWorkspace =
    session.workspaces.find((workspace) => workspace.workspaceId === session.activeWorkspaceId) ??
    session.workspaces[0]
  return activeWorkspace ? `/app/${activeWorkspace.workspaceSlug}` : "/login"
}

export function selectOAuthContinuationRedirect(redirectTo: string | null | undefined) {
  const safeRedirect = sanitizeRedirect(redirectTo)
  return safeRedirect && isOAuthContinuationRedirect(safeRedirect) ? safeRedirect : null
}

function sanitizeRedirect(redirectTo: string | null | undefined): string | null {
  if (!redirectTo) return null
  if (redirectTo.startsWith("/")) {
    if (redirectTo.startsWith("//")) return null
    return redirectTo
  }

  const browserOrigin = getBrowserOrigin()
  if (!browserOrigin) return null

  try {
    const url = new URL(redirectTo)
    if (url.origin !== browserOrigin && !isAllowedAuthOriginOAuthRedirect(url)) return null
    if (url.origin !== browserOrigin) return url.toString()
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function isOAuthContinuationRedirect(redirectTo: string) {
  return (
    redirectTo.startsWith("/oauth/authorize/resume?") ||
    isAllowedAuthOriginOAuthRedirectUrl(redirectTo)
  )
}

function getBrowserOrigin() {
  return typeof location === "undefined" ? null : location.origin
}

function isAllowedAuthOriginOAuthRedirect(url: URL) {
  if (!url.pathname.startsWith("/oauth/authorize/resume")) return false

  return allowedAuthOrigins().includes(url.origin)
}

function isAllowedAuthOriginOAuthRedirectUrl(redirectTo: string) {
  try {
    return isAllowedAuthOriginOAuthRedirect(new URL(redirectTo))
  } catch {
    return false
  }
}

function allowedAuthOrigins() {
  return [
    import.meta.env.VITE_CONTEXTBASE_AUTH_BASE_URL,
    import.meta.env.VITE_AUTH_BASE_URL,
    "http://127.0.0.1:3317",
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter((value): value is string => Boolean(value))
}

function targetsAccessibleWorkspace(session: AuthSession, redirectTo: string): boolean {
  if (!redirectTo.startsWith("/app/")) return false
  const [, appSegment, workspaceSlug] = redirectTo.split("/")
  if (appSegment !== "app" || !workspaceSlug) return false
  return session.workspaces.some((workspace) => workspace.workspaceSlug === workspaceSlug)
}

function selectRememberedWorkspaceRedirect(
  session: AuthSession,
  preference: WorkspaceSelectionPreference | null,
) {
  if (!preference?.lastWorkspaceId) return null

  const workspace = session.workspaces.find(
    (candidate) => candidate.workspaceId === preference.lastWorkspaceId,
  )
  return workspace ? `/app/${workspace.workspaceSlug}` : null
}

export function readWorkspaceSelectionPreference(
  storage: Pick<SelectionStorage, "getItem"> | null | undefined = browserStorage(),
): WorkspaceSelectionPreference {
  return {
    lastWorkspaceId: storage?.getItem(lastWorkspaceKey) ?? null,
  }
}

export function rememberWorkspaceSelection(
  selection: { workspaceId: string },
  storage: SelectionStorage | null | undefined = browserStorage(),
) {
  if (!storage) return
  storage.setItem(lastWorkspaceKey, selection.workspaceId)
}

function browserStorage(): SelectionStorage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}
