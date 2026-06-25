import { createFileRoute } from "@tanstack/react-router"

import { VerifyPage } from "../domains/auth/screens/VerifyPage"

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search) => ({
    redirect_to: typeof search.redirect_to === "string" ? search.redirect_to : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: VerifyRoute,
})

function VerifyRoute() {
  const { redirect_to: redirectTo, token } = Route.useSearch()
  return <VerifyPage redirectTo={redirectTo} token={token} />
}
