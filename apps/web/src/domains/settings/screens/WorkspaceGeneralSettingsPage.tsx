import { queries } from "@contextbase/zero-schema"
import { useQuery as useZeroQuery } from "@rocicorp/zero/react"
import { useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { trpc } from "../../../trpc/react"
import { normalizeOnboardingSlug } from "../../auth/client/onboarding-slugs"
import { sessionQueryKey, useSession } from "../../auth/client/use-session"
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

export function WorkspaceGeneralSettingsPage() {
  const session = useSession()
  const [workspace] = useZeroQuery(queries.activeWorkspace())
  const workspaceName = workspace?.workspaceName ?? ""
  const workspaceSlug = workspace?.workspaceSlug ?? session.data?.activeWorkspaceSlug ?? ""
  const workspaceId = workspace?.id ?? session.data?.activeWorkspaceId ?? ""

  return (
    <SettingsPage>
      <SettingsPageContent className="flex flex-col gap-8">
        <SettingsPageTitle>General</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Workspace details</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Workspace name</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="text-sm text-muted-foreground">
                {workspaceName || "Not available"}
              </span>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Workspace URL</SettingsRowTitle>
                <SettingsRowDescription>
                  Changing this updates workspace links.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-muted-foreground">
                  {workspaceSlug || "Not available"}
                </span>
                {workspaceSlug ? <WorkspaceSlugDialog workspaceSlug={workspaceSlug} /> : null}
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Workspace ID</SettingsRowTitle>
              </SettingsRowLabel>
              <span className="font-mono text-xs text-muted-foreground">
                {workspaceId || "Not available"}
              </span>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPageContent>
    </SettingsPage>
  )
}

function WorkspaceSlugDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const inputId = useId()
  const trpcUtils = trpc.useUtils()
  const queryClient = useQueryClient()
  const updateSlugMutation = trpc.settings.workspace.updateSlug.useMutation()
  const [open, setOpen] = useState(false)
  const [slugInput, setSlugInput] = useState(workspaceSlug)
  const [debouncedSlug, setDebouncedSlug] = useState(workspaceSlug)
  const [formError, setFormError] = useState("")
  const normalizedSlug = normalizeOnboardingSlug(slugInput)
  const slugChanged = normalizedSlug !== workspaceSlug
  const slugAvailability = trpc.settings.workspace.slugAvailability.useQuery(
    { workspaceSlug: debouncedSlug },
    {
      enabled: open && Boolean(debouncedSlug),
    },
  )
  const isCheckingSlug = open && normalizedSlug === debouncedSlug && slugAvailability.isFetching
  const isSlugAvailable = slugAvailability.data?.available === true
  const canSave =
    slugChanged &&
    Boolean(normalizedSlug) &&
    isSlugAvailable &&
    !isCheckingSlug &&
    !updateSlugMutation.isPending
  const statusMessage = !normalizedSlug
    ? "Use lowercase letters, numbers, and hyphens."
    : normalizedSlug !== debouncedSlug
      ? "Checking..."
      : isCheckingSlug
        ? "Checking..."
        : isSlugAvailable
          ? "Workspace slug is available."
          : "Workspace slug is already taken."
  const statusTone =
    !normalizedSlug || (!isCheckingSlug && normalizedSlug === debouncedSlug && !isSlugAvailable)
      ? "text-destructive"
      : "text-muted-foreground"

  useEffect(() => {
    if (!open) return

    setSlugInput(workspaceSlug)
    setDebouncedSlug(workspaceSlug)
    setFormError("")
  }, [open, workspaceSlug])

  useEffect(() => {
    if (!open) return

    const timeoutId = setTimeout(() => {
      setDebouncedSlug(normalizedSlug)
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [normalizedSlug, open])

  async function saveSlug() {
    if (!canSave) return

    setFormError("")
    try {
      await updateSlugMutation.mutateAsync({ workspaceSlug: normalizedSlug })
      await Promise.all([
        trpcUtils.settings.workspace.slugAvailability.invalidate(),
        queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
      ])
      setOpen(false)
      toast.success("Workspace slug updated.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update workspace slug."
      setFormError(
        message.toLowerCase().includes("already") ? "Choose a different workspace slug." : message,
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        aria-label="Change workspace slug"
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <PencilIcon className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change workspace slug</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor={inputId}>
              Workspace slug
            </label>
            <Input
              autoCapitalize="none"
              autoCorrect="off"
              id={inputId}
              onChange={(event) => {
                setSlugInput(normalizeOnboardingSlug(event.target.value))
                setFormError("")
              }}
              spellCheck={false}
              value={slugInput}
            />
            <p aria-live="polite" className={`min-h-5 text-sm ${statusTone}`}>
              {statusMessage}
            </p>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button disabled={!canSave} onClick={saveSlug} type="button">
            Save slug
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
