import { createFileRoute } from "@tanstack/react-router"

import { SignupVerifyPage } from "../domains/auth/screens/SignupVerifyPage"

export const Route = createFileRoute("/auth/signup/verify")({
  validateSearch: (search) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: SignupVerifyRoute,
})

function SignupVerifyRoute() {
  const { token } = Route.useSearch()
  return <SignupVerifyPage token={token} />
}
