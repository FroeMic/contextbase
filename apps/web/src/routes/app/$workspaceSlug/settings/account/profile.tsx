import { createFileRoute } from "@tanstack/react-router"

import { AccountProfileSettingsPage } from "../../../../../domains/settings/screens/AccountProfileSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/account/profile")({
  component: AccountProfileSettingsPage,
  ssr: false,
})
