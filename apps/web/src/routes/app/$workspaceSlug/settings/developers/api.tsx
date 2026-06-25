import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceApiSettingsPage } from "../../../../../domains/settings/screens/WorkspaceApiSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/developers/api")({
  component: WorkspaceApiSettingsPage,
  ssr: false,
})
