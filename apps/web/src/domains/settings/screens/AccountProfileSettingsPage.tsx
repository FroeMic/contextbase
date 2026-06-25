import { queries } from "@contextbase/zero-schema"
import { useQuery as useZeroQuery } from "@rocicorp/zero/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "../../../shared/theme/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "../../../shared/ui/avatar"
import { Button } from "../../../shared/ui/button"
import { Input } from "../../../shared/ui/input"
import { trpc } from "../../../trpc/react"
import { useSession } from "../../auth/client/use-session"
import { buildPublicAvatarUrl } from "../client/public-avatar-url"
import { AvatarImageUploader } from "../components/AvatarImageUploader"
import {
  SettingsCard,
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "../components/SettingsLayout"

export function AccountProfileSettingsPage() {
  const session = useSession()
  const { setTheme, theme } = useTheme()
  const {
    error: profileSaveError,
    isPending: isProfileSavePending,
    mutateAsync: updateProfile,
  } = trpc.settings.profile.update.useMutation()
  const [nameInput, setNameInput] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedNameRef = useRef("")
  const lastAttemptedNameRef = useRef("")
  const [profile] = useZeroQuery(queries.currentUser())
  const [profileAvatarFile] = useZeroQuery(
    profile?.avatarFileObjectId
      ? queries.publicAvatarFile({ fileId: profile.avatarFileObjectId })
      : null,
  )
  const email = profile?.email ?? session.data?.email ?? ""
  const displayName = profile?.displayName ?? email ?? "Signed-in user"
  const initials = getInitials(displayName)
  const profileAvatarUrl = buildPublicAvatarUrl(profileAvatarFile)
  const displayAvatarUrl = avatarUrl || profileAvatarUrl || ""
  const profileError = profileSaveError?.message ?? ""

  useEffect(() => {
    if (profile?.displayName) {
      setNameInput(profile.displayName)
      lastSavedNameRef.current = profile.displayName
      lastAttemptedNameRef.current = ""
    }
  }, [profile?.displayName])

  const saveProfileName = useCallback(
    async (value: string) => {
      const displayName = value.trim()
      if (!profile || !displayName) return
      if (isProfileSavePending) return
      if (displayName === lastSavedNameRef.current) return
      if (displayName === lastAttemptedNameRef.current) return

      lastAttemptedNameRef.current = displayName
      try {
        await updateProfile({ displayName })
        lastSavedNameRef.current = displayName
        lastAttemptedNameRef.current = ""
      } catch {
        // React Query owns the visible mutation error; don't retry the same value automatically.
      }
    },
    [isProfileSavePending, profile, updateProfile],
  )

  useEffect(() => {
    if (!profile) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      void saveProfileName(nameInput)
    }, 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [nameInput, profile, saveProfileName])

  async function uploadAvatar(blob: Blob) {
    const formData = new FormData()
    formData.set("file", new File([blob], "avatar.webp", { type: "image/webp" }))

    const response = await fetch("/api/settings/account/avatar", {
      body: formData,
      method: "POST",
    })
    const body = await response.json()
    if (!response.ok || !body.ok) {
      throw new Error(body.error?.message ?? "Avatar upload failed.")
    }

    setAvatarUrl(body.data.avatarUrl)
  }

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>Account</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Profile</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-10">
                  {displayAvatarUrl ? <AvatarImage alt="" src={displayAvatarUrl} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <SettingsRowLabel>
                  <SettingsRowTitle>Profile photo</SettingsRowTitle>
                  <SettingsRowDescription>
                    Upload a public avatar for your user account.
                  </SettingsRowDescription>
                </SettingsRowLabel>
              </div>
              <AvatarImageUploader onUpload={uploadAvatar} />
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Name</SettingsRowTitle>
              </SettingsRowLabel>
              <Input
                aria-label="Name"
                className="h-8 w-full max-w-sm sm:w-56"
                disabled={isProfileSavePending}
                onChange={(event) => setNameInput(event.target.value)}
                value={nameInput}
              />
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Email</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">{email || "Not available"}</span>
            </SettingsRow>
            {profileError ? (
              <div className="px-5 pb-4 text-sm text-destructive">{profileError}</div>
            ) : null}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Preferences</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Theme</SettingsRowTitle>
                <SettingsRowDescription>
                  Choose how Contextbase appears in this browser.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex items-center gap-1 rounded-full border border-border bg-input/30 p-1">
                {(["system", "light", "dark"] as const).map((option) => (
                  <Button
                    key={option}
                    onClick={() => setTheme(option)}
                    size="xs"
                    type="button"
                    variant={theme === option ? "secondary" : "ghost"}
                  >
                    {formatTheme(option)}
                  </Button>
                ))}
              </div>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}

function getInitials(value: string) {
  const initials = value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "U"
}

function formatTheme(value: "dark" | "light" | "system") {
  if (value === "system") return "System"
  if (value === "light") return "Light"
  return "Dark"
}
