import { describe, expect, test, vi } from "vitest"

const capturePostHogBrowserException = vi.hoisted(() => vi.fn())

vi.mock("./posthog-client", () => ({
  capturePostHogBrowserException,
}))

import { PostHogBrowserErrorBoundary } from "./PostHogBrowserErrorBoundary"

describe("PostHog browser error boundary", () => {
  test("captures render errors with bounded route and component stack metadata", () => {
    vi.stubGlobal("window", {
      location: {
        pathname: "/core/tasks",
      },
    })
    const error = new Error("render failed")
    const boundary = new PostHogBrowserErrorBoundary({ children: null })

    boundary.componentDidCatch(error, {
      componentStack: "\n    at TasksPage\n    at Root",
    })

    expect(capturePostHogBrowserException).toHaveBeenCalledWith(error, {
      component_stack: "\n    at TasksPage\n    at Root",
      route_pathname: "/core/tasks",
      service_name: "vertical-web",
      surface: "web",
    })
  })
})
