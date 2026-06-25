import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/app/$workspaceSlug/settings/developers/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      to: "/app/$workspaceSlug/settings/developers/api",
    })
  },
})
