import { createFileRoute } from "@tanstack/react-router"

import { AccountSecuritySettingsPage } from "../../../../../domains/settings/screens/AccountSecuritySettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/account/security")({
  component: AccountSecuritySettingsPage,
  ssr: false,
})
