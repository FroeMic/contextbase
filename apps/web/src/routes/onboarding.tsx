import { createFileRoute } from "@tanstack/react-router"

import {
  generateFriendlySlug,
  OnboardingPage,
  selectRandomProfilePlaceholder,
} from "../domains/auth/screens/OnboardingPage"

export const Route = createFileRoute("/onboarding")({
  loader: () => ({
    generatedWorkspaceSlug: generateFriendlySlug(),
    profilePlaceholder: selectRandomProfilePlaceholder(),
  }),
  component: OnboardingRoute,
})

function OnboardingRoute() {
  const state = Route.useLoaderData()

  return (
    <OnboardingPage
      email={null}
      generatedWorkspaceSlug={state.generatedWorkspaceSlug}
      profilePlaceholder={state.profilePlaceholder}
    />
  )
}
