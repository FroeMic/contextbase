import { createFileRoute } from "@tanstack/react-router"

import { DeveloperCliSettingsPage } from "../../../../../domains/settings/screens/DeveloperCliSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/developers/cli")({
  component: DeveloperCliSettingsPage,
  ssr: false,
})
