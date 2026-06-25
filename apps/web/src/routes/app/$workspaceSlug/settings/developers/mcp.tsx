import { createFileRoute } from "@tanstack/react-router"

import { DeveloperMcpSettingsPage } from "../../../../../domains/settings/screens/DeveloperMcpSettingsPage"

export const Route = createFileRoute("/app/$workspaceSlug/settings/developers/mcp")({
  component: DeveloperMcpSettingsPage,
  ssr: false,
})
