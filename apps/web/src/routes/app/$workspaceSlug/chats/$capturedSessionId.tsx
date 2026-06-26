import { createFileRoute } from "@tanstack/react-router"

import { CapturedChatTranscriptPage } from "../../../../domains/captured-chats/components"
import { requireActiveWorkspaceSession } from "../-workspace-route-loader"

export const Route = createFileRoute("/app/$workspaceSlug/chats/$capturedSessionId")({
  component: CapturedChatDetailRouteComponent,
  loader: async ({ context, params }) => {
    await requireActiveWorkspaceSession({
      queryClient: context.queryClient,
      workspaceSlug: params.workspaceSlug,
    })

    return {
      capturedSessionId: params.capturedSessionId,
      frameSlotKey: `captured-chat:${params.capturedSessionId}`,
      frameSlots: {
        contentPadding: "none",
        breadcrumbs: [{ label: "Chats" }],
        title: "Captured chat",
      },
      workspaceSlug: params.workspaceSlug,
    }
  },
})

function CapturedChatDetailRouteComponent() {
  const { capturedSessionId, workspaceSlug } = Route.useLoaderData()

  return (
    <CapturedChatTranscriptPage
      capturedSessionId={capturedSessionId}
      workspaceSlug={workspaceSlug}
    />
  )
}
