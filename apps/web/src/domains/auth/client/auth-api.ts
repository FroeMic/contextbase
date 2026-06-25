import type { FeatureFlagSnapshot } from "../../feature-flags/client/feature-flag-snapshot"
import type { MagicLinkClientKind } from "./desktop-auth"
import type { OnboardingSlugKind } from "./onboarding-slugs"

export type AuthSession = {
  activeWorkspaceId: string
  activeWorkspaceRole: string
  activeWorkspaceSlug: string
  email: string
  expiresAt: string
  featureFlags: FeatureFlagSnapshot
  sessionId: string
  userId: string
  workspaces: Array<{
    role: string
    workspaceId: string
    workspaceSlug: string
  }>
}

export class AuthApiError extends Error {
  code: string
  details: Record<string, unknown>
  status: number

  constructor(input: {
    code: string
    details?: Record<string, unknown>
    message: string
    status: number
  }) {
    super(input.message)
    this.name = "AuthApiError"
    this.code = input.code
    this.details = input.details ?? {}
    this.status = input.status
  }
}

type Fetcher = typeof fetch

export type AuthApiOptions = {
  fetcher?: Fetcher
}

export async function requestMagicLink(
  input: { clientKind?: MagicLinkClientKind; email: string; redirectTo?: string | null },
  options: AuthApiOptions = {},
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    "/api/auth/magic-link/request",
    {
      body: JSON.stringify({
        ...(input.clientKind ? { clientKind: input.clientKind } : {}),
        email: input.email,
        redirectTo: input.redirectTo ?? null,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function requestSignupVerification(
  input: { email: string },
  options: AuthApiOptions = {},
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(
    "/api/auth/signup/request",
    {
      body: JSON.stringify({
        email: input.email,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function consumeSignupVerification(
  token: string,
  options: AuthApiOptions = {},
): Promise<{
  data: {
    onboardingRequired: true
    onboardingSessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/signup/consume",
    {
      body: JSON.stringify({ token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function completeSignupOnboarding(
  input: {
    profileName: string
    workspaceName: string
    workspaceSlug: string
  },
  options: AuthApiOptions = {},
): Promise<{
  data: {
    activeWorkspaceId: string
    activeWorkspaceSlug: string
    expiresAt: string
    sessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/onboarding/complete",
    {
      body: JSON.stringify({
        profileName: input.profileName,
        workspaceName: input.workspaceName,
        workspaceSlug: input.workspaceSlug,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function checkOnboardingSlugAvailability(
  input: { kind: OnboardingSlugKind; slug: string },
  options: AuthApiOptions = {},
): Promise<{ data: { available: boolean }; ok: true }> {
  const params = new URLSearchParams({
    kind: input.kind,
    slug: input.slug,
  })
  return requestJson(
    `/api/auth/onboarding/slug-availability?${params.toString()}`,
    {
      method: "GET",
    },
    options,
  )
}

export async function consumeMagicLink(
  token: string,
  options: AuthApiOptions = {},
): Promise<{
  data: {
    activeWorkspaceId: string
    activeWorkspaceSlug: string
    expiresAt: string
    sessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/magic-link/consume",
    {
      body: JSON.stringify({ token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function acceptWorkspaceInvitation(
  token: string,
  options: AuthApiOptions = {},
): Promise<{
  data: {
    activeWorkspaceId: string
    activeWorkspaceSlug: string
    expiresAt: string
    sessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/invitations/accept",
    {
      body: JSON.stringify({ token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function loginWithPassword(
  input: { email: string; password: string },
  options: AuthApiOptions = {},
): Promise<{
  data: {
    activeWorkspaceId: string
    activeWorkspaceSlug: string
    expiresAt: string
    sessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/password/login",
    {
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function fetchCurrentSession(
  options: AuthApiOptions = {},
): Promise<{ data: AuthSession; ok: true }> {
  return requestJson(
    "/api/auth/session",
    {
      method: "GET",
    },
    options,
  )
}

export async function switchWorkspace(
  workspaceId: string,
  options: AuthApiOptions = {},
): Promise<{
  data: {
    activeWorkspaceId: string
    activeWorkspaceSlug: string
    expiresAt: string
    sessionId: string
    userId: string
  }
  ok: true
}> {
  return requestJson(
    "/api/auth/workspace/select",
    {
      body: JSON.stringify({ workspaceId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    options,
  )
}

export async function logout(options: AuthApiOptions = {}): Promise<{ ok: true }> {
  return requestJson(
    "/api/auth/logout",
    {
      method: "POST",
    },
    options,
  )
}

async function requestJson<T>(
  input: string,
  init: RequestInit,
  options: AuthApiOptions,
): Promise<T> {
  const response = await (options.fetcher ?? fetch)(input, init)
  const body = (await response.json().catch(() => ({}))) as {
    error?: {
      code?: string
      details?: Record<string, unknown>
      message?: string
    }
  }

  if (!response.ok) {
    throw new AuthApiError({
      code: body.error?.code ?? "internal_error",
      details: body.error?.details,
      message: body.error?.message ?? "Request failed.",
      status: response.status,
    })
  }

  return body as T
}
