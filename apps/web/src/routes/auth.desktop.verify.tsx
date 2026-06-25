import { createFileRoute } from "@tanstack/react-router"

import { DesktopVerifyPage } from "../domains/auth/screens/DesktopVerifyPage"

export const Route = createFileRoute("/auth/desktop/verify")({
  validateSearch: (search) => ({
    redirect_to: typeof search.redirect_to === "string" ? search.redirect_to : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: DesktopVerifyRoute,
})

function DesktopVerifyRoute() {
  const { redirect_to: redirectTo, token } = Route.useSearch()
  return <DesktopVerifyPage redirectTo={redirectTo} token={token} />
}
