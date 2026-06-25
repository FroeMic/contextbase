import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import { Button } from "../../shared/ui/button"
import { Sidebar, SidebarHeader, SidebarRail } from "../../shared/ui/sidebar"
import { WorkspaceSettingsNavigation } from "./WorkspaceSettingsNavigation"

export function WorkspaceSettingsSidebar({
  activeWorkspaceSlug,
  isWorkspaceAdmin,
}: {
  activeWorkspaceSlug: string
  isWorkspaceAdmin: boolean
}) {
  return (
    <Sidebar className="absolute h-full" collapsible="offcanvas" variant="inset">
      <SidebarHeader className="flex h-12 flex-row items-center justify-between">
        <Button
          className="text-sm! font-normal!"
          nativeButton={false}
          render={<Link params={{ workspaceSlug: activeWorkspaceSlug }} to="/app/$workspaceSlug" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft className="size-4" />
          Back to app
        </Button>
      </SidebarHeader>
      <WorkspaceSettingsNavigation
        activeWorkspaceSlug={activeWorkspaceSlug}
        isWorkspaceAdmin={isWorkspaceAdmin}
      />
      <SidebarRail />
    </Sidebar>
  )
}
