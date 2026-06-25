import { Building2, Check, UserRound } from "lucide-react"
import type * as React from "react"
import { useEffect, useId, useMemo, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

import { identifyPostHogBrowserSession } from "../../analytics/posthog-client"
import { AvatarImageUploader } from "../../settings/components/AvatarImageUploader"
import {
  checkOnboardingSlugAvailability,
  completeSignupOnboarding,
  fetchCurrentSession,
} from "../client/auth-api"
import {
  generateFriendlySlug,
  normalizeOnboardingSlug,
  type OnboardingSlugKind,
} from "../client/onboarding-slugs"
import { readWorkspaceSelectionPreference, selectPostLoginRedirect } from "../client/redirect"

type SlugAvailability = "available" | "checking" | "invalid" | "taken"

export type ProfilePlaceholderExample = {
  name: string
  title: string
}

export const profilePlaceholderExamples = [
  { name: "Marty McFly", title: "Time traveler" },
  { name: "John Connor", title: "Future resistance leader" },
  { name: "Leia Organa", title: "Rebel general" },
  { name: "Aang", title: "Air nomad" },
  { name: "Leslie Knope", title: "Parks director" },
  { name: "Ted Lasso", title: "Coach" },
  { name: "Jean-Luc Picard", title: "Starship captain" },
  { name: "Diana Prince", title: "Ambassador" },
  { name: "Samwise Gamgee", title: "Loyal companion" },
  { name: "Hermione Granger", title: "Problem solver" },
  { name: "Miles Morales", title: "Neighborhood hero" },
  { name: "Ellen Ripley", title: "Survivor" },
] as const satisfies readonly ProfilePlaceholderExample[]

const steps = [
  { icon: UserRound, label: "Set up your profile" },
  { icon: Building2, label: "Create your workspace" },
] as const

export function OnboardingPage({
  email,
  generatedWorkspaceSlug = generateFriendlySlug(),
  profilePlaceholder = profilePlaceholderExamples[0],
}: {
  email: string | null
  generatedWorkspaceSlug?: string
  profilePlaceholder?: ProfilePlaceholderExample
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("")
  const [profileName, setProfileName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [workspaceSlug, setWorkspaceSlug] = useState(() =>
    normalizeOnboardingSlug(generatedWorkspaceSlug),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const workspaceSlugAvailability = useSlugAvailability("workspace", workspaceSlug)
  const canContinue = useMemo(() => {
    if (currentStep === 0) return profileName.trim().length > 0
    if (currentStep === 1) {
      return workspaceName.trim().length > 0 && workspaceSlugAvailability === "available"
    }
    return true
  }, [currentStep, profileName, workspaceName, workspaceSlugAvailability])

  useEffect(() => {
    if (!avatarBlob) {
      setAvatarPreviewUrl("")
      return
    }

    const objectUrl = URL.createObjectURL(avatarBlob)
    setAvatarPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [avatarBlob])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!canContinue) return

    if (currentStep < steps.length - 1) {
      setCurrentStep((step) => step + 1)
      return
    }

    setIsSubmitting(true)
    try {
      await completeSignupOnboarding({
        profileName,
        workspaceName,
        workspaceSlug,
      })
      const session = await fetchCurrentSession()
      if (avatarBlob) {
        await uploadOnboardingAvatar(avatarBlob).catch(() => undefined)
      }
      identifyPostHogBrowserSession(session.data)
      window.location.assign(
        selectPostLoginRedirect(session.data, undefined, readWorkspaceSelectionPreference()),
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to complete onboarding.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section className="flex min-h-dvh flex-col justify-between gap-8 border-border border-r p-6 md:p-10">
        <div>
          <div className="max-w-md">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {currentStep + 1} of {steps.length}
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">Set up your workspace</h1>
          </div>
        </div>
        <ol className="grid gap-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isComplete = index < currentStep
            return (
              <li
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm " +
                  (isActive ? "bg-muted text-foreground" : "text-muted-foreground")
                }
                key={step.label}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background">
                  {isComplete ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span>{step.label}</span>
              </li>
            )
          })}
        </ol>
      </section>
      <section className="flex min-h-dvh items-start justify-center p-6 pt-20 md:p-10 md:pt-28">
        <form
          className="grid min-h-[560px] w-full max-w-md grid-rows-[auto_1fr_auto] gap-8"
          onSubmit={submit}
        >
          <div>
            {currentStep === 0 ? (
              <ProfileStep
                avatarPreviewUrl={avatarPreviewUrl}
                email={email}
                onAvatarUpload={setAvatarBlob}
                placeholder={profilePlaceholder}
                profileName={profileName}
                setProfileName={setProfileName}
              />
            ) : null}
            {currentStep === 1 ? (
              <WorkspaceStep
                setWorkspaceName={setWorkspaceName}
                setWorkspaceSlug={setWorkspaceSlug}
                slugAvailability={workspaceSlugAvailability}
                workspaceName={workspaceName}
                workspaceSlug={workspaceSlug}
              />
            ) : null}
          </div>
          <p aria-live="polite" className="min-h-5 self-start text-sm text-destructive">
            {error}
          </p>
          <div className="flex items-center justify-between self-end">
            {currentStep === 0 ? (
              <span aria-hidden="true" className="invisible h-10 w-20" />
            ) : (
              <Button
                onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                type="button"
                variant="ghost"
              >
                Back
              </Button>
            )}
            <Button disabled={isSubmitting || !canContinue} type="submit">
              {isSubmitting
                ? "Finishing..."
                : currentStep === steps.length - 1
                  ? "Finish"
                  : "Continue"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

function ProfileStep({
  avatarPreviewUrl,
  email,
  onAvatarUpload,
  placeholder,
  profileName,
  setProfileName,
}: {
  avatarPreviewUrl: string
  email: string | null
  onAvatarUpload: (blob: Blob) => void
  placeholder: ProfilePlaceholderExample
  profileName: string
  setProfileName: (value: string) => void
}) {
  const nameId = useId()
  const emailId = useId()
  const displayName = profileName.trim() || placeholder.name
  return (
    <div className="grid gap-6">
      <StepHeader
        description="Choose how teammates will see you in this workspace."
        title="Set up your profile"
      />
      <div className="grid gap-3">
        <Label htmlFor={nameId}>Name & picture</Label>
        <div className="flex items-center gap-3">
          <AvatarImageUploader
            aria-label="Upload profile avatar"
            className="shrink-0"
            onUpload={onAvatarUpload}
          >
            <Avatar className="size-11 border border-border">
              {avatarPreviewUrl ? <AvatarImage alt="" src={avatarPreviewUrl} /> : null}
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          </AvatarImageUploader>
          <Input
            autoComplete="name"
            className="h-11 flex-1"
            id={nameId}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder={placeholder.name}
            required
            value={profileName}
          />
        </div>
      </div>
      <div className="grid gap-3">
        <Label htmlFor={emailId}>Verified email</Label>
        <Input id={emailId} readOnly value={email ?? "Email verified for this signup"} />
      </div>
    </div>
  )
}

function WorkspaceStep({
  setWorkspaceName,
  setWorkspaceSlug,
  slugAvailability,
  workspaceName,
  workspaceSlug,
}: {
  setWorkspaceName: (value: string) => void
  setWorkspaceSlug: (value: string) => void
  slugAvailability: SlugAvailability
  workspaceName: string
  workspaceSlug: string
}) {
  const workspaceId = useId()
  return (
    <div className="grid gap-6">
      <StepHeader
        description="This becomes the shared place for members and captured session history."
        title="Create your workspace"
      />
      <div className="grid gap-3">
        <Label htmlFor={workspaceId}>Workspace name</Label>
        <Input
          id={workspaceId}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Acme Engineering"
          required
          value={workspaceName}
        />
      </div>
      <SlugField
        availability={slugAvailability}
        label="Workspace slug"
        setSlug={setWorkspaceSlug}
        slug={workspaceSlug}
      />
    </div>
  )
}

function SlugField({
  availability,
  label,
  setSlug,
  slug,
}: {
  availability: SlugAvailability
  label: string
  setSlug: (value: string) => void
  slug: string
}) {
  const id = useId()
  const message =
    availability === "available"
      ? "Available"
      : availability === "checking"
        ? "Checking..."
        : availability === "taken"
          ? "Already taken"
          : "Use lowercase letters, numbers, and hyphens."
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        autoCapitalize="none"
        autoCorrect="off"
        id={id}
        onChange={(event) => setSlug(normalizeOnboardingSlug(event.target.value))}
        required
        spellCheck={false}
        value={slug}
      />
      <p
        aria-live="polite"
        className={
          "min-h-5 text-sm " +
          (availability === "available"
            ? "text-muted-foreground"
            : availability === "checking"
              ? "text-muted-foreground"
              : "text-destructive")
        }
      >
        {message}
      </p>
    </div>
  )
}

function StepHeader({ description, title }: { description: string; title: string }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function selectRandomProfilePlaceholder(): ProfilePlaceholderExample {
  return profilePlaceholderExamples[Math.floor(Math.random() * profilePlaceholderExamples.length)]
}

export { generateFriendlySlug }

function useSlugAvailability(kind: OnboardingSlugKind, slug: string): SlugAvailability {
  const [availability, setAvailability] = useState<SlugAvailability>(() =>
    normalizeOnboardingSlug(slug) ? "checking" : "invalid",
  )

  useEffect(() => {
    const normalizedSlug = normalizeOnboardingSlug(slug)
    if (!normalizedSlug) {
      setAvailability("invalid")
      return
    }

    setAvailability("checking")
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void checkOnboardingSlugAvailability({ kind, slug: normalizedSlug })
        .then((response) => {
          if (!cancelled) setAvailability(response.data.available ? "available" : "taken")
        })
        .catch(() => {
          if (!cancelled) setAvailability("taken")
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [kind, slug])

  return availability
}

async function uploadOnboardingAvatar(blob: Blob) {
  const formData = new FormData()
  formData.set("file", new File([blob], "avatar.webp", { type: "image/webp" }))

  const response = await fetch("/api/settings/account/avatar", {
    body: formData,
    method: "POST",
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.ok) {
    throw new Error(body.error?.message ?? "Avatar upload failed.")
  }
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
