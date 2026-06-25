import { createFileRoute } from "@tanstack/react-router"

import { LandingHomePage } from "../domains/landing/pages/HomeLandingPage"
import { getLandingSessionState } from "../domains/landing/server/landing-session"

export const Route = createFileRoute("/")({
  component: IndexRoute,
  loader: () => getLandingSessionState(),
})

function IndexRoute() {
  const session = Route.useLoaderData()

  return <LandingHomePage isSignedIn={session.isSignedIn} />
}
