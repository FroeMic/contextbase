import { useQueryClient } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import { Building2, CodeXml, LockKeyholeOpen, Plug, Terminal, User, Users } from "lucide-react"
import type { AnchorHTMLAttributes, ComponentType, SyntheticEvent } from "react"
import { useCallback } from "react"
import { prefetchSettingsPage } from "../../domains/settings/navigation/settings-page-prefetch"
import { usePreloadIntent } from "../../shared/intent/use-preload-intent"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../shared/ui/sidebar"
import {
  workspaceSettingsNavigation,
  workspaceSettingsSections,
} from "./workspace-settings-navigation"

const pageIconByKey = {
  "building-2": Building2,
  "code-xml": CodeXml,
  "lock-keyhole-open": LockKeyholeOpen,
  plug: Plug,
  terminal: Terminal,
  user: User,
  users: Users,
} as const

export function WorkspaceSettingsNavigation({
  activeWorkspaceSlug,
  isWorkspaceAdmin,
}: {
  activeWorkspaceSlug: string
  isWorkspaceAdmin: boolean
}) {
  return (
    <SidebarContent>
      <nav aria-label="Settings navigation">
        {workspaceSettingsSections.map((section) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel className="px-2">{section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceSettingsNavigation
                  .filter(
                    (item) => item.section === section && (!item.adminOnly || isWorkspaceAdmin),
                  )
                  .map((item) => {
                    const Icon = pageIconByKey[item.icon]

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={
                            <WorkspaceSettingsNavigationLink
                              activeWorkspaceSlug={activeWorkspaceSlug}
                              icon={Icon}
                              item={item}
                            />
                          }
                          size="sm"
                        />
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </nav>
    </SidebarContent>
  )
}

function WorkspaceSettingsNavigationLink({
  activeWorkspaceSlug,
  icon: Icon,
  item,
  ...linkProps
}: {
  activeWorkspaceSlug: string
  icon: ComponentType
  item: (typeof workspaceSettingsNavigation)[number]
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const intentHandlers = useWorkspaceSettingsPagePreloadIntent({
    href: item.href,
    workspaceSlug: activeWorkspaceSlug,
  })

  return (
    <Link
      {...linkProps}
      {...intentHandlers}
      activeProps={{ "data-active": true }}
      params={{ workspaceSlug: activeWorkspaceSlug }}
      preload="intent"
      to={item.href}
    >
      <Icon />
      <span>{item.label}</span>
    </Link>
  )
}

function useWorkspaceSettingsPagePreloadIntent({
  href,
  workspaceSlug,
}: {
  href: (typeof workspaceSettingsNavigation)[number]["href"]
  workspaceSlug: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const preload = useCallback(
    () =>
      Promise.all([
        router.preloadRoute({
          params: { workspaceSlug },
          to: href,
        }),
        prefetchSettingsPage({
          pathname: href,
          queryClient,
        }),
      ]),
    [href, queryClient, router, workspaceSlug],
  )

  return usePreloadIntent<SyntheticEvent<HTMLAnchorElement>>({
    key: `workspace-settings:${workspaceSlug}:${href}`,
    preload,
  })
}
