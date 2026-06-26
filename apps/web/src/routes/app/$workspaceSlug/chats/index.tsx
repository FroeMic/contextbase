import { createFileRoute } from "@tanstack/react-router"

import { CapturedChatsListPage } from "../../../../domains/captured-chats/components"
import { requireActiveWorkspaceSession } from "../-workspace-route-loader"

export const Route = createFileRoute("/app/$workspaceSlug/chats/")({
  component: CapturedChatsRouteComponent,
  loader: async ({ context, params }) => {
    await requireActiveWorkspaceSession({
      queryClient: context.queryClient,
      workspaceSlug: params.workspaceSlug,
    })

    return {
      frameSlotKey: "captured-chats",
      frameSlots: { contentPadding: "none", title: "Chats" },
      workspaceSlug: params.workspaceSlug,
    }
  },
})

function CapturedChatsRouteComponent() {
  const { workspaceSlug } = Route.useLoaderData()

  return <CapturedChatsListPage workspaceSlug={workspaceSlug} />
}
