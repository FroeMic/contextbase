import { useQueryClient } from "@tanstack/react-query"
import { Link, Outlet, useMatches, useNavigate } from "@tanstack/react-router"
import { Check, ChevronDown, Database, LogOut, MessageSquareText, Settings } from "lucide-react"
import { useMemo } from "react"

import { PostHogBrowserIdentity } from "../../domains/analytics/PostHogBrowserIdentity"
import { resetPostHogBrowserSession } from "../../domains/analytics/posthog-client"
import type { AuthSession } from "../../domains/auth/client/auth-api"
import { logout } from "../../domains/auth/client/auth-api"
import { sessionQueryKey } from "../../domains/auth/client/use-session"
import { CapturedChatsSidebarSection } from "../../domains/captured-chats/components"
import { FeatureFlagProvider } from "../../domains/feature-flags/client/FeatureFlagProvider"
import { settingsQueryKeys } from "../../domains/settings/client/settings-query-options"
import { ZeroClientProvider } from "../../domains/zero/client/ZeroClientProvider"
import { getOrCreateBrowserZero } from "../../domains/zero/client/zero-client-registry"
import { cn } from "../../shared/ui/cn"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../shared/ui/dropdown-menu"
import { Separator } from "../../shared/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "../../shared/ui/sidebar"
import type { AppFrameSlots } from "../frame"
import {
  AppFrameContent,
  AppFrameHeader,
  AppFrameHeightBanner,
  AppFrameProvider,
  AppFrameStage,
  AppFrameViewport,
  useAppFrameSlots,
} from "../frame"

const DEFAULT_WORKSPACE_ROUTE_SLOT_KEY = "workspace-route-default"

type WorkspaceFrameRouteMatch = {
  loaderData?: unknown
}

export function WorkspaceFrame({
  session,
  workspaceSlug,
}: {
  session: AuthSession
  workspaceSlug: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const matches = useMatches()
  const routeFrameSlots = selectWorkspaceRouteFrameSlots(matches)
  const zero = useMemo(() => getOrCreateBrowserZero(session), [session])

  async function logOut() {
    await logout()
    resetPostHogBrowserSession()
    queryClient.removeQueries({ queryKey: sessionQueryKey })
    queryClient.removeQueries({ queryKey: settingsQueryKeys.security() })
    queryClient.removeQueries({
      queryKey: settingsQueryKeys.securitySessions(),
    })
    await navigate({ search: { redirect_to: undefined }, to: "/login" })
  }

  return (
    <FeatureFlagProvider
      sessionKey={[session.userId, session.sessionId, session.activeWorkspaceId].join(":")}
      snapshot={session.featureFlags}
      storageScopeKey={[session.userId, session.activeWorkspaceId].join(":")}
    >
      <ZeroClientProvider session={session} zero={zero}>
        <PostHogBrowserIdentity session={session} />
        <AppFrameProvider slotResetKey={routeFrameSlots.key} slots={routeFrameSlots.slots}>
          <SidebarProvider>
            <AppFrameViewport>
              <AppFrameHeightBanner />
              <AppFrameStage
                sidebar={
                  <WorkspaceSidebar
                    activeWorkspaceSlug={workspaceSlug}
                    session={session}
                    onLogout={logOut}
                  />
                }
              >
                <WorkspaceMainColumn />
              </AppFrameStage>
            </AppFrameViewport>
          </SidebarProvider>
        </AppFrameProvider>
      </ZeroClientProvider>
    </FeatureFlagProvider>
  )
}

function WorkspaceSidebar({
  activeWorkspaceSlug,
  session,
  onLogout,
}: {
  activeWorkspaceSlug: string
  session: AuthSession
  onLogout: () => void | Promise<void>
}) {
  return (
    <Sidebar
      className="absolute h-full"
      collapsible="offcanvas"
      data-slot="workspace-sidebar"
      variant="inset"
    >
      <SidebarHeader className="gap-2">
        <WorkspaceSwitcherMenu
          activeWorkspaceSlug={activeWorkspaceSlug}
          onLogout={onLogout}
          workspaces={session.workspaces}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      params={{ workspaceSlug: activeWorkspaceSlug }}
                      preload="intent"
                      to="/app/$workspaceSlug"
                    />
                  }
                >
                  <Database />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      params={{ workspaceSlug: activeWorkspaceSlug }}
                      preload="intent"
                      to="/app/$workspaceSlug/chats"
                    />
                  }
                >
                  <MessageSquareText />
                  <span>Chats</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <CapturedChatsSidebarSection workspaceSlug={activeWorkspaceSlug} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function WorkspaceSwitcherMenu({
  activeWorkspaceSlug,
  onLogout,
  workspaces,
}: {
  activeWorkspaceSlug: string
  onLogout?: () => Promise<void> | void
  workspaces: AuthSession["workspaces"]
}) {
  const items = mergeWorkspaceList(activeWorkspaceSlug, workspaces)

  return (
    <div data-slot="workspace-switcher-menu">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
            "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
          )}
        >
          <WorkspaceLogo name={activeWorkspaceSlug} />
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold">Contextbase</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">
              {activeWorkspaceSlug}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 duration-0 data-closed:animate-none data-open:animate-none">
          <DropdownMenuItem
            render={
              <Link
                params={{ workspaceSlug: activeWorkspaceSlug }}
                preload="intent"
                to="/app/$workspaceSlug/settings"
              />
            }
          >
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <WorkspaceLogo name={activeWorkspaceSlug} size="xs" tone="muted" />
                <span className="min-w-0 flex-1 truncate">Switch Workspace</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                {items.map((item) => {
                  const isCurrent = item.workspaceSlug === activeWorkspaceSlug

                  return (
                    <DropdownMenuItem
                      key={item.workspaceSlug}
                      render={
                        <Link
                          params={{ workspaceSlug: item.workspaceSlug }}
                          preload="intent"
                          to="/app/$workspaceSlug"
                        />
                      }
                    >
                      <WorkspaceLogo name={item.workspaceSlug} size="xs" tone="muted" />
                      <span className="min-w-0 flex-1 truncate">{item.workspaceSlug}</span>
                      {item.role ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatWorkspaceRole(item.role)}
                        </span>
                      ) : null}
                      {isCurrent ? <Check className="size-4 shrink-0" /> : null}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void onLogout?.()
            }}
            variant="destructive"
          >
            <LogOut className="size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function WorkspaceLogo({
  name,
  size = "sm",
  tone = "solid",
}: {
  name: string
  size?: "xs" | "sm"
  tone?: "muted" | "solid"
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center font-semibold",
        size === "xs" ? "size-4 rounded-[4px] text-[9px]" : "size-6 rounded-md text-xs",
        tone === "solid"
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "bg-sidebar-accent text-sidebar-foreground",
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function mergeWorkspaceList(activeWorkspaceSlug: string, workspaces: AuthSession["workspaces"]) {
  const bySlug = new Map<string, AuthSession["workspaces"][number]>()
  for (const workspace of workspaces) {
    bySlug.set(workspace.workspaceSlug, workspace)
  }
  if (!bySlug.has(activeWorkspaceSlug)) {
    bySlug.set(activeWorkspaceSlug, {
      role: "",
      workspaceId: activeWorkspaceSlug,
      workspaceSlug: activeWorkspaceSlug,
    })
  }
  return Array.from(bySlug.values()).sort((a, b) => a.workspaceSlug.localeCompare(b.workspaceSlug))
}

function formatWorkspaceRole(role: string) {
  if (role === "workspace_admin") return "Admin"
  if (role === "workspace_member") return "Member"
  return role
}

function WorkspaceMainColumn() {
  const slots = useAppFrameSlots()

  return (
    <SidebarInset className="min-h-0 overflow-hidden bg-transparent md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.03)]"
        data-slot="workspace-main-surface"
      >
        <AppFrameHeader
          start={
            <>
              <SidebarTrigger aria-label="Toggle sidebar" className="-ml-1 hidden md:inline-flex" />
              <Separator
                className="mr-2 hidden data-vertical:h-4 data-vertical:self-center md:block"
                orientation="vertical"
              />
              <WorkspaceHeaderRouteContext breadcrumbs={slots.breadcrumbs} title={slots.title} />
              {slots.routeContextActions ? (
                <div className="flex shrink-0 items-center gap-1">{slots.routeContextActions}</div>
              ) : null}
            </>
          }
          end={slots.headerActions}
        />
        <AppFrameContent>
          <div
            className={cn(
              "h-full min-h-0 overflow-hidden",
              slots.contentPadding === "none" ? "p-0" : "p-0 md:p-4 md:pt-0 md:pb-4",
            )}
          >
            <Outlet />
          </div>
        </AppFrameContent>
      </section>
    </SidebarInset>
  )
}

function WorkspaceHeaderRouteContext({
  breadcrumbs,
  title,
}: {
  breadcrumbs?: readonly { href?: string; label: string }[]
  title?: string
}) {
  if (!title && !breadcrumbs?.length) return null
  const items = [
    ...(breadcrumbs ?? []),
    ...(title
      ? [
          { current: true, label: title } satisfies {
            current: boolean
            label: string
          },
        ]
      : []),
  ]

  return (
    <nav aria-label="Current location" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((item, index) => (
          <li
            className={cn(
              "min-w-0 truncate",
              index === items.length - 1 ? "font-medium text-foreground" : "text-muted-foreground",
            )}
            key={`${item.label}-${index}`}
          >
            {index > 0 ? <span className="mx-1 text-muted-foreground/60">/</span> : null}
            <span>{item.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function selectWorkspaceRouteFrameSlots(matches: readonly WorkspaceFrameRouteMatch[]): {
  key: string
  slots: AppFrameSlots | undefined
} {
  for (const match of [...matches].reverse()) {
    const loaderData = match.loaderData as
      | {
          frameSlotKey?: string
          frameSlots?: AppFrameSlots
        }
      | null
      | undefined

    if (loaderData?.frameSlots !== undefined) {
      return {
        key: loaderData.frameSlotKey ?? DEFAULT_WORKSPACE_ROUTE_SLOT_KEY,
        slots: loaderData.frameSlots,
      }
    }
  }

  return {
    key: DEFAULT_WORKSPACE_ROUTE_SLOT_KEY,
    slots: undefined,
  }
}
