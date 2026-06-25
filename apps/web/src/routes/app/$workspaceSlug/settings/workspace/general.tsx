import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceGeneralSettingsPage } from "../../../../../domains/settings/screens/WorkspaceGeneralSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/workspace/general")({
  component: WorkspaceGeneralSettingsPage,
  ssr: false,
})
