import interLatinFontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url"
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router"
import { AppProviders } from "../app/providers/AppProviders"
import type { AppRouterContext } from "../app/router-context"
import { getBrowserPostHogBootScript as getServerBrowserPostHogBootScript } from "../domains/analytics/posthog-server"
import appCss from "../styles/app.css?url"

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootRouteComponent,
  head: () => ({
    links: [
      {
        as: "font",
        crossOrigin: "anonymous",
        href: interLatinFontUrl,
        rel: "preload",
        type: "font/woff2",
      },
      { href: appCss, rel: "stylesheet" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "Contextbase" },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{getAppShellBootStyle()}</style>
        <style>{getSidebarBootStyle()}</style>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Static boot script applies a non-sensitive first-paint shell marker.
          dangerouslySetInnerHTML={{ __html: getAppShellBootScript() }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Static boot script applies persisted shell sizing before hydration.
          dangerouslySetInnerHTML={{ __html: getSidebarBootScript() }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Serialized analytics config is escaped and contains only the public PostHog token.
          dangerouslySetInnerHTML={{ __html: getBrowserPostHogBootScript() }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function getAppShellBootStyle() {
  return `
:root{--app-shell-sidebar-width:16rem;--app-shell-margin:.5rem;--app-shell-bottom-dock-height:1.75rem;--app-shell-radius:calc(0.45rem * 1.4);--app-shell-bg:oklch(0.985 0 0);--app-shell-surface:oklch(0.99913 0.001 286.38)}
@media (prefers-color-scheme:dark){:root{--app-shell-bg:oklch(0.205 0 0);--app-shell-surface:oklch(0.145 0 0)}}
html[data-auth-shell="app"] body{background:var(--sidebar,var(--app-shell-bg))}
html[data-auth-shell="app"] body::before,html[data-auth-shell="app"] body::after{content:"";position:fixed;pointer-events:none}
html[data-auth-shell="app"] body::before{inset:0;z-index:0;background:var(--sidebar,var(--app-shell-bg))}
html[data-auth-shell="app"] body::after{top:var(--app-shell-margin);right:var(--app-shell-margin);bottom:calc(var(--app-shell-margin) + var(--app-shell-bottom-dock-height));left:var(--app-shell-sidebar-width);z-index:0;border-radius:var(--radius-xl,var(--app-shell-radius));background:var(--background,var(--app-shell-surface));box-shadow:0 1px 2px rgb(0 0 0 / .03)}
html[data-auth-shell="app"][data-sidebar-state="collapsed"] body::after{left:var(--app-shell-margin)}
html[data-auth-shell="app"] body > :not([data-slot="drawer-portal"]):not([data-slot="drawer-overlay"]):not([data-slot="drawer-content"]):not([data-slot="dialog-portal"]):not([data-slot="dialog-overlay"]):not([data-slot="dialog-content"]):not([data-slot="alert-dialog-portal"]):not([data-slot="alert-dialog-overlay"]):not([data-slot="alert-dialog-content"]):not([data-slot="datatable-preview-portal"]):not([data-slot="mobile-navigation-dock-portal"]):not([data-slot="settings-mobile-navigation-dock-portal"]){position:relative;z-index:1}
@media (max-width:47.999rem){html[data-auth-shell="app"]{--sidebar:var(--background,var(--app-shell-surface))}html[data-auth-shell="app"] body::after{left:var(--app-shell-margin)}}
`
}

function getSidebarBootStyle() {
  return `
@media (min-width:48rem){
html[data-sidebar-state="collapsed"] [data-slot="sidebar-gap"]{width:0!important}
html[data-sidebar-state="collapsed"] [data-slot="sidebar-container"][data-side="left"]{left:calc(var(--sidebar-width)*-1)!important}
html[data-sidebar-state="collapsed"] [data-slot="sidebar-container"][data-side="right"]{right:calc(var(--sidebar-width)*-1)!important}
html[data-sidebar-state="collapsed"] [data-slot="sidebar-inset"]{margin-left:.5rem!important}
}
`
}

function getAppShellBootScript() {
  return `(function(){try{var pathname=location.pathname;if(pathname==="/"||pathname==="/login"||pathname==="/create"||pathname.indexOf("/auth/")===0||pathname.indexOf("/workspaces/")===0){return}var match=document.cookie.match(/(?:^|; )contextbase_auth_shell=([^;]*)/);if(match&&decodeURIComponent(match[1])==="1"){document.documentElement.setAttribute("data-auth-shell","app");document.documentElement.setAttribute("data-auth-shell-ready","true")}}catch(error){}})();`
}

function getSidebarBootScript() {
  return `(function(){try{var match=document.cookie.match(/(?:^|; )sidebar_state=([^;]*)/);var value=match?decodeURIComponent(match[1]):null;if(value==="true"||value==="false"){document.documentElement.setAttribute("data-sidebar-state",value==="true"?"expanded":"collapsed")}}catch(error){}})();`
}

function getBrowserPostHogBootScript() {
  return getServerBrowserPostHogBootScript(readServerEnv())
}

function readServerEnv(): NodeJS.ProcessEnv {
  return typeof process === "undefined" ? {} : process.env
}

export function RootRouteComponent() {
  const router = useRouter()
  const queryClient = router.options.context.queryClient

  return (
    <AppProviders queryClient={queryClient}>
      <Outlet />
    </AppProviders>
  )
}
