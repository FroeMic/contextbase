import { Component, type ErrorInfo, type ReactNode } from "react"

import { capturePostHogBrowserException } from "./posthog-client"

type PostHogBrowserErrorBoundaryProps = {
  children: ReactNode
}

type PostHogBrowserErrorBoundaryState = {
  hasError: boolean
}

export class PostHogBrowserErrorBoundary extends Component<
  PostHogBrowserErrorBoundaryProps,
  PostHogBrowserErrorBoundaryState
> {
  state: PostHogBrowserErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): PostHogBrowserErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    capturePostHogBrowserException(error, {
      component_stack: truncateComponentStack(errorInfo.componentStack ?? ""),
      route_pathname: readRoutePathname(),
      service_name: "vertical-web",
      surface: "web",
    })
  }

  render() {
    if (this.state.hasError) {
      return <div role="alert">Something went wrong.</div>
    }

    return this.props.children
  }
}

function readRoutePathname(): string {
  return typeof window === "undefined" ? "" : window.location.pathname
}

function truncateComponentStack(componentStack: string): string {
  return componentStack.length > 4_000 ? `${componentStack.slice(0, 4_000)}...` : componentStack
}
