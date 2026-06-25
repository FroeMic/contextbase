import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceSelectPage } from "../domains/auth/screens/WorkspaceSelectPage"

export const Route = createFileRoute("/workspaces/select")({
  validateSearch: (search) => ({
    redirect_to: typeof search.redirect_to === "string" ? search.redirect_to : undefined,
  }),
  component: WorkspaceSelectRoute,
})

function WorkspaceSelectRoute() {
  const { redirect_to: redirectTo } = Route.useSearch()
  return <WorkspaceSelectPage redirectTo={redirectTo} />
}
