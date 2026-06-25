import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceMembersSettingsPage } from "../../../../../domains/settings/screens/WorkspaceMembersSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/workspace/members")({
  component: WorkspaceMembersSettingsPage,
  ssr: false,
})
