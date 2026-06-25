import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { PostHogBrowserAnalytics } from "../../domains/analytics/PostHogBrowserAnalytics"
import { PostHogBrowserErrorBoundary } from "../../domains/analytics/PostHogBrowserErrorBoundary"
import { BrowserHistoryShortcuts } from "../../shared/navigation/BrowserHistoryShortcuts"
import { ThemeProvider } from "../../shared/theme/theme-provider"
import { Toaster } from "../../shared/ui/sonner"
import { TooltipProvider } from "../../shared/ui/tooltip"
import { TrpcProvider } from "../../trpc/client"

export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient: QueryClient
}) {
  return (
    <TrpcProvider queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="vertical-ui-theme">
          <TooltipProvider>
            <PostHogBrowserAnalytics />
            <PostHogBrowserErrorBoundary>
              <BrowserHistoryShortcuts />
              {children}
            </PostHogBrowserErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </TrpcProvider>
  )
}
