import { createFileRoute } from "@tanstack/react-router"

import { LoginPage } from "../domains/auth/screens/LoginPage"
import { getLoginSessionState } from "../domains/auth/server/login-session"

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect_to: typeof search.redirect_to === "string" ? search.redirect_to : undefined,
  }),
  loader: () => getLoginSessionState(),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect_to: redirectTo } = Route.useSearch()
  const session = Route.useLoaderData()

  return <LoginPage redirectTo={redirectTo} session={session.session} />
}
