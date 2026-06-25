import { createFileRoute } from "@tanstack/react-router"

import { InvitationAcceptPage } from "../domains/auth/screens/InvitationAcceptPage"

export const Route = createFileRoute("/auth/invitations/accept")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: InvitationAcceptRoute,
})

function InvitationAcceptRoute() {
  const { token } = Route.useSearch()
  return <InvitationAcceptPage token={token} />
}
