import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/app/$workspaceSlug/settings/account/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      to: "/app/$workspaceSlug/settings/account/profile",
    })
  },
})
