import { useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog"
import { Input } from "../../../shared/ui/input"
import { Skeleton } from "../../../shared/ui/skeleton"
import { trpc } from "../../../trpc/react"
import { securitySettingsQueryOptions, settingsQueryKeys } from "../client/settings-query-options"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "./SettingsLayout"

export function PasswordSettingsSection() {
  const securityQuery = useQuery(securitySettingsQueryOptions())
  const passwordMutation = trpc.settings.security.updatePassword.useMutation()
  const queryClient = useQueryClient()
  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordFormError, setPasswordFormError] = useState("")
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const passwordEnabled = securityQuery.data?.passwordEnabled
  const error = securityQuery.error?.message ?? ""

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordMutation.isPending) return
    setPasswordFormError("")

    try {
      await passwordMutation.mutateAsync({
        currentPassword: passwordEnabled === true ? currentPassword : undefined,
        newPassword: password,
      })
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.security() })
      setCurrentPassword("")
      setPassword("")
      setPasswordDialogOpen(false)
      toast.success(
        passwordEnabled === true ? "Password changed successfully." : "Password set successfully.",
      )
    } catch (error) {
      setPasswordFormError(error instanceof Error ? error.message : "Unable to update password.")
    }
  }

  function openPasswordDialog() {
    if (securityQuery.isPending) return
    setCurrentPassword("")
    setPassword("")
    setPasswordFormError("")
    setPasswordDialogOpen(true)
  }

  function updatePasswordDialogOpen(open: boolean) {
    setPasswordDialogOpen(open)
    if (!open) {
      setPasswordFormError("")
    }
  }

  return (
    <SettingsSection>
      <SettingsSectionTitle>Password</SettingsSectionTitle>
      <SettingsSectionDescription>
        Set or change the password for your Contextbase account.
      </SettingsSectionDescription>
      <SettingsCard>
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowTitle>Password</SettingsRowTitle>
            {securityQuery.isPending ? (
              <Skeleton className="mt-1 h-4 w-64 max-w-full" />
            ) : (
              <SettingsRowDescription>
                {passwordEnabled === true
                  ? "Password sign-in is enabled for this account."
                  : "Add a password to sign in without a magic link."}
              </SettingsRowDescription>
            )}
          </SettingsRowLabel>
          <Button
            disabled={passwordMutation.isPending || securityQuery.isPending}
            onClick={openPasswordDialog}
            size="sm"
            type="button"
            variant="outline"
          >
            {securityQuery.isPending ? (
              <Skeleton className="h-4 w-20" />
            ) : passwordEnabled === true ? (
              "Change password"
            ) : (
              "Set password"
            )}
          </Button>
        </SettingsRow>
        {error ? <div className="px-5 pb-4 text-sm text-destructive">{error}</div> : null}
      </SettingsCard>
      <Dialog open={isPasswordDialogOpen} onOpenChange={updatePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passwordEnabled === true ? "Change password" : "Set password"}
            </DialogTitle>
            <DialogDescription>
              Use at least 12 characters. Keep this password separate from other services.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitPassword}>
            {passwordEnabled === true ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor={currentPasswordId}>
                  Current password
                </label>
                <Input
                  autoComplete="current-password"
                  id={currentPasswordId}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={newPasswordId}>
                New password
              </label>
              <Input
                autoComplete="new-password"
                id={newPasswordId}
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {passwordFormError ? (
              <p className="text-sm text-destructive">{passwordFormError}</p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={passwordMutation.isPending}
                size="sm"
                type="submit"
                variant="default"
              >
                {passwordMutation.isPending
                  ? "Saving..."
                  : passwordEnabled === true
                    ? "Change password"
                    : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
