import { createFileRoute } from "@tanstack/react-router"

import { requireActiveWorkspaceSession } from "./-workspace-route-loader"

export const Route = createFileRoute("/app/$workspaceSlug/")({
  component: WorkspaceAppRouteComponent,
  loader: async ({ context, params }) => {
    await requireActiveWorkspaceSession({
      queryClient: context.queryClient,
      workspaceSlug: params.workspaceSlug,
    })

    return {
      frameSlotKey: "workspace-overview",
      frameSlots: { contentPadding: "default", title: "Overview" },
      workspaceSlug: params.workspaceSlug,
    }
  },
})

function WorkspaceAppRouteComponent() {
  const { workspaceSlug } = Route.useLoaderData()

  return (
    <main className="flex h-full min-h-[28rem] flex-col gap-6 rounded-lg border border-border bg-card p-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Contextbase workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">
          {workspaceSlug}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The workspace, user management, settings, API, files, MCP, and database foundation is
          ready. Session capture will be added as a separate OpenSpec change.
        </p>
      </div>
    </main>
  )
}
