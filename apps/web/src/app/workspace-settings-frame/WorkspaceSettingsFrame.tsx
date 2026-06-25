import { useQueryClient } from "@tanstack/react-query"
import { Outlet, useLocation } from "@tanstack/react-router"
import { useEffect } from "react"

import { PostHogBrowserIdentity } from "../../domains/analytics/PostHogBrowserIdentity"
import type { AuthSession } from "../../domains/auth/client/auth-api"
import { FeatureFlagProvider } from "../../domains/feature-flags/client/FeatureFlagProvider"
import { prefetchSettingsPage } from "../../domains/settings/navigation/settings-page-prefetch"
import { ZeroClientProvider } from "../../domains/zero/client/ZeroClientProvider"
import { SidebarInset, SidebarProvider } from "../../shared/ui/sidebar"
import {
  AppFrameContent,
  AppFrameHeightBanner,
  AppFrameProvider,
  AppFrameStage,
  AppFrameViewport,
} from "../frame"
import { WorkspaceSettingsSidebar } from "./WorkspaceSettingsSidebar"

export function WorkspaceSettingsFrame({
  session,
  workspaceSlug,
}: {
  session: AuthSession
  workspaceSlug: string
}) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const isWorkspaceAdmin = canAdminWorkspaceRole(session.activeWorkspaceRole)

  useEffect(() => {
    void prefetchSettingsPage({
      pathname: location.pathname,
      queryClient,
    })
  }, [location.pathname, queryClient])

  return (
    <FeatureFlagProvider
      sessionKey={[session.userId, session.sessionId, session.activeWorkspaceId].join(":")}
      snapshot={session.featureFlags}
      storageScopeKey={[session.userId, session.activeWorkspaceId].join(":")}
    >
      <ZeroClientProvider session={session}>
        <PostHogBrowserIdentity session={session} />
        <AppFrameProvider>
          <SidebarProvider>
            <AppFrameViewport>
              <AppFrameHeightBanner />
              <AppFrameStage
                sidebar={
                  <WorkspaceSettingsSidebar
                    activeWorkspaceSlug={workspaceSlug}
                    isWorkspaceAdmin={isWorkspaceAdmin}
                  />
                }
              >
                <SidebarInset className="min-h-0 overflow-hidden bg-transparent md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
                  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
                    <AppFrameContent>
                      <div className="h-full min-h-0 overflow-y-auto p-6 pb-32 md:pb-6">
                        <Outlet />
                      </div>
                    </AppFrameContent>
                  </section>
                </SidebarInset>
              </AppFrameStage>
            </AppFrameViewport>
          </SidebarProvider>
        </AppFrameProvider>
      </ZeroClientProvider>
    </FeatureFlagProvider>
  )
}

function canAdminWorkspaceRole(role: string) {
  return role === "workspace_admin"
}
