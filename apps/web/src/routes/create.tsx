import { createFileRoute } from "@tanstack/react-router"

import { LoginPage } from "../domains/auth/screens/LoginPage"
import {
  OnboardingPage,
  selectRandomProfilePlaceholder,
} from "../domains/auth/screens/OnboardingPage"
import { getCreateSessionState } from "../domains/auth/server/login-session"

export const Route = createFileRoute("/create")({
  loader: async () => ({
    ...(await getCreateSessionState()),
    profilePlaceholder: selectRandomProfilePlaceholder(),
  }),
  component: CreateRoute,
})

function CreateRoute() {
  const session = Route.useLoaderData()

  if (session.onboardingRequired) {
    return (
      <OnboardingPage
        email={session.onboardingEmail}
        generatedWorkspaceSlug={session.generatedWorkspaceSlug}
        profilePlaceholder={session.profilePlaceholder}
      />
    )
  }

  return <LoginPage initialMode="signup" session={session.session} />
}
