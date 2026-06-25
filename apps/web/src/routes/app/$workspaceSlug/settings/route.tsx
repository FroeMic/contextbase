import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceSettingsFrame } from "../../../../app/workspace-settings-frame/WorkspaceSettingsFrame"
import { AuthenticatedRouteErrorPage } from "../../../../domains/auth/screens/AuthenticatedRouteErrorPage"
import { requireActiveWorkspaceSession } from "../-workspace-route-loader"

export const Route = createFileRoute("/app/$workspaceSlug/settings")({
  component: WorkspaceSettingsRouteComponent,
  errorComponent: ({ error }) => <AuthenticatedRouteErrorPage error={error} />,
  loader: async ({ context, params }) => {
    const session = await requireActiveWorkspaceSession({
      queryClient: context.queryClient,
      workspaceSlug: params.workspaceSlug,
    })

    return { session, workspaceSlug: params.workspaceSlug }
  },
})

function WorkspaceSettingsRouteComponent() {
  const { session, workspaceSlug } = Route.useLoaderData()

  return <WorkspaceSettingsFrame session={session} workspaceSlug={workspaceSlug} />
}
