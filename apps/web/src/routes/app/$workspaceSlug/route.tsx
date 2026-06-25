import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router"

import { WorkspaceFrame } from "../../../app/workspace-frame/WorkspaceFrame"
import { AuthenticatedRouteErrorPage } from "../../../domains/auth/screens/AuthenticatedRouteErrorPage"
import { requireActiveWorkspaceSession } from "./-workspace-route-loader"

export const Route = createFileRoute("/app/$workspaceSlug")({
  component: WorkspaceAppRouteComponent,
  errorComponent: ({ error }) => <AuthenticatedRouteErrorPage error={error} />,
  loader: async ({ context, params }) => {
    const session = await requireActiveWorkspaceSession({
      queryClient: context.queryClient,
      workspaceSlug: params.workspaceSlug,
    })

    return { session, workspaceSlug: params.workspaceSlug }
  },
})

function WorkspaceAppRouteComponent() {
  const { session, workspaceSlug } = Route.useLoaderData()
  const location = useLocation()

  if (isWorkspaceSettingsPathname(location.pathname, workspaceSlug)) {
    return <Outlet />
  }

  return <WorkspaceFrame session={session} workspaceSlug={workspaceSlug} />
}

function isWorkspaceSettingsPathname(pathname: string, workspaceSlug: string) {
  const settingsPath = `/app/${encodeURIComponent(workspaceSlug)}/settings`

  return pathname === settingsPath || pathname.startsWith(`${settingsPath}/`)
}
