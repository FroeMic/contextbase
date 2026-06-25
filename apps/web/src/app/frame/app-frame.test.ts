import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import {
  AppFrameBottomDock,
  AppFrameContent,
  AppFrameHeader,
  AppFrameHeightBanner,
  AppFrameMainColumn,
  AppFrameStage,
  AppFrameSurface,
  AppFrameViewport,
  defaultAppFrameSlots,
  mergeAppFrameSlots,
  resolveBottomDockClassName,
  selectAppFrameBanner,
  useAppFrameBannerEffect,
  useAppFrameSlotEffect,
} from "."

describe("app frame primitives", () => {
  test("exports the required reset frame components", () => {
    expect(AppFrameViewport).toBeTypeOf("function")
    expect(AppFrameHeightBanner).toBeTypeOf("function")
    expect(AppFrameStage).toBeTypeOf("function")
    expect(AppFrameMainColumn).toBeTypeOf("function")
    expect(AppFrameSurface).toBeTypeOf("function")
    expect(AppFrameHeader).toBeTypeOf("function")
    expect(AppFrameContent).toBeTypeOf("function")
    expect(AppFrameBottomDock).toBeTypeOf("function")
  })

  test("keeps the bottom dock visible by default and collapsible per page", () => {
    expect(defaultAppFrameSlots.bottomDockMode).toBe("default")
    expect(resolveBottomDockClassName("default")).toContain("h-7")
    expect(resolveBottomDockClassName("default")).toContain("pt-1")
    expect(resolveBottomDockClassName("default")).not.toContain("px-")
    expect(resolveBottomDockClassName("default")).not.toContain("pb-[env(safe-area-inset-bottom)]")
    expect(resolveBottomDockClassName("hidden")).toContain("hidden")
  })

  test("bottom dock pins page controls and admin controls to the far end", () => {
    const dockSource = readFileSync(
      join(process.cwd(), "src/app/frame/AppFrameBottomDock.tsx"),
      "utf8",
    )
    const toggleSource = readFileSync(
      join(process.cwd(), "src/app/theme/AppThemeToggle.tsx"),
      "utf8",
    )

    expect(dockSource).toContain("AppThemeToggle")
    expect(dockSource).toContain("FeatureFlagOverrideDockButton")
    expect(dockSource).toContain("ml-auto")
    expect(resolveBottomDockClassName("default")).toContain("w-full")
    expect(dockSource).toContain("end?: ReactNode")
    expect(dockSource.indexOf("{end}")).toBeLessThan(dockSource.indexOf("<AppThemeToggle"))
    expect(dockSource.indexOf("<AppThemeToggle")).toBeLessThan(
      dockSource.indexOf("<FeatureFlagOverrideDockButton"),
    )
    expect(toggleSource).toContain("useTheme")
    expect(toggleSource).toContain('setTheme(theme === "dark" ? "light" : "dark")')
    expect(toggleSource).toContain("../../shared/theme/theme-provider")
    expect(toggleSource).toContain('variant="ghost"')
    expect(toggleSource).toContain('size="icon-xs"')
    expect(toggleSource).toContain('aria-label="Toggle color theme"')
    expect(toggleSource).toContain("tabler-icon-brightness")
  })

  test("app providers install the shadcn TanStack Start theme provider with cookie-backed persistence", () => {
    const providersSource = readFileSync(
      join(process.cwd(), "src/app/providers/AppProviders.tsx"),
      "utf8",
    )
    const themeProviderSource = readFileSync(
      join(process.cwd(), "src/shared/theme/theme-provider.tsx"),
      "utf8",
    )

    expect(providersSource).toContain("ThemeProvider")
    expect(providersSource).toContain('storageKey="vertical-ui-theme"')
    expect(providersSource).toContain('defaultTheme="light"')
    expect(providersSource).not.toContain('attribute="class"')
    expect(themeProviderSource).toContain("ScriptOnce")
    expect(themeProviderSource).toContain("localStorage.getItem")
    expect(themeProviderSource).toContain("localStorage.setItem")
    expect(themeProviderSource).toContain("document.cookie")
    expect(themeProviderSource).toContain("vertical-ui-theme")
    expect(themeProviderSource).toContain("Max-Age=31536000")
    expect(themeProviderSource).toContain('root.classList.remove("light", "dark")')
    expect(themeProviderSource).not.toContain('from "next-themes"')
  })

  test("root document suppresses theme-class hydration warnings", () => {
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(rootSource).toContain("<html")
    expect(rootSource).toContain("suppressHydrationWarning")
  })

  test("root document restores persisted sidebar state before first paint", () => {
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(rootSource).toContain("getSidebarBootScript")
    expect(rootSource).toContain("data-sidebar-state")
    expect(rootSource).toContain("sidebar_state")
    expect(rootSource.indexOf("getSidebarBootScript")).toBeLessThan(
      rootSource.indexOf("<HeadContent />"),
    )
  })

  test("root document paints only authenticated app routes with a critical shell silhouette", () => {
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(rootSource).toContain("getAppShellBootStyle")
    expect(rootSource).toContain("getAppShellBootScript")
    expect(rootSource).toContain("contextbase_auth_shell")
    expect(rootSource).toContain('setAttribute("data-auth-shell","app")')
    expect(rootSource).toContain("data-auth-shell-ready")
    expect(rootSource).toContain(":root{--app-shell-sidebar-width:16rem")
    expect(rootSource).toContain("--app-shell-radius:calc(0.45rem * 1.4)")
    expect(rootSource).toContain("border-radius:var(--radius-xl,var(--app-shell-radius))")
    expect(rootSource).not.toContain("--app-shell-radius:.75rem")
    expect(rootSource).toContain("--app-shell-bottom-dock-height:1.75rem")
    expect(rootSource).toContain("left:var(--app-shell-sidebar-width)")
    expect(rootSource).toContain(
      "bottom:calc(var(--app-shell-margin) + var(--app-shell-bottom-dock-height))",
    )
    expect(rootSource).toContain(':not([data-slot="drawer-content"])')
    expect(rootSource).toContain(':not([data-slot="drawer-overlay"])')
    expect(rootSource).toContain(':not([data-slot="dialog-content"])')
    expect(rootSource).toContain(':not([data-slot="dialog-overlay"])')
    expect(rootSource).not.toContain("body>*{position:relative;z-index:1}")
    expect(rootSource).not.toContain(
      "body::after{top:var(--app-shell-margin);right:var(--app-shell-margin);bottom:calc(var(--app-shell-margin) + var(--app-shell-bottom-dock-height));left:var(--app-shell-sidebar-width);z-index:0;border:",
    )
    expect(rootSource).toContain('pathname==="/login"')
    expect(rootSource).toContain('pathname==="/"')
    expect(rootSource).not.toContain("Business Brief")
    expect(rootSource).not.toContain("Goals")
    expect(rootSource).not.toContain("Tasks")
    expect(rootSource.indexOf("getAppShellBootScript")).toBeLessThan(
      rootSource.indexOf("<HeadContent />"),
    )
  })

  test("root document preloads the primary Inter font before the app stylesheet", () => {
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(rootSource).toContain(
      "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url",
    )
    expect(rootSource).toContain('rel: "preload"')
    expect(rootSource).toContain('as: "font"')
    expect(rootSource).toContain('type: "font/woff2"')
    expect(rootSource).toContain('crossOrigin: "anonymous"')
    expect(rootSource.indexOf("interLatinFontUrl")).toBeLessThan(rootSource.indexOf("appCss"))
  })

  test("main frame surfaces are borderless and keep a subdued shadow", () => {
    const source = readFileSync(join(process.cwd(), "src/app/frame/AppFrameSurface.tsx"), "utf8")

    expect(source).not.toContain("border ")
    expect(source).not.toContain("border-border/50")
    expect(source).toContain("shadow-[0_1px_2px_rgb(0_0_0/0.03)]")
    expect(source).not.toContain("shadow-sm")
  })

  test("main column headers use a compact 44px height", () => {
    const source = readFileSync(join(process.cwd(), "src/app/frame/AppFrameHeader.tsx"), "utf8")

    expect(source).toContain("h-11")
    expect(source).not.toContain("h-16")
  })

  test("viewport stretches across the sidebar provider on desktop", () => {
    const source = readFileSync(join(process.cwd(), "src/app/frame/AppFrameViewport.tsx"), "utf8")

    expect(source).toContain("w-full")
    expect(source).toContain("flex-1")
  })

  test("frame stage constrains generated sidebar containers below banners", () => {
    const source = readFileSync(join(process.cwd(), "src/app/frame/AppFrameStage.tsx"), "utf8")

    expect(source).toContain("relative")
  })

  test("sidebar provider restores collapse state after route remounts", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/sidebar.tsx"), "utf8")

    expect(source).toContain("getSidebarCookieOpenState")
    expect(source).toContain("React.useState(() => getSidebarCookieOpenState(defaultOpen))")
  })

  test("sidebar provider keeps the pre-paint root sidebar state in sync after hydration", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/sidebar.tsx"), "utf8")

    expect(source).toContain("syncSidebarRootOpenState")
    expect(source).toContain('document.documentElement.setAttribute("data-sidebar-state"')
    expect(source.indexOf("document.cookie")).toBeLessThan(
      source.indexOf("syncSidebarRootOpenState(openState)"),
    )
  })

  test("sidebar keyboard shortcut ignores editor and form targets", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/sidebar.tsx"), "utf8")

    expect(source).toContain("isSidebarShortcutEditableTarget")
    expect(source).toContain("[contenteditable='true']")
    expect(source).toContain("[role='textbox']")
    expect(source).toContain("event.target")
    expect(source.indexOf("isSidebarShortcutEditableTarget(event.target)")).toBeLessThan(
      source.indexOf("toggleSidebar()"),
    )
  })

  test("exposes a route-owned slot lifecycle helper", () => {
    expect(useAppFrameSlotEffect).toBeTypeOf("function")
    expect(mergeAppFrameSlots({ title: "Tasks", bottomDockMode: "hidden" })).toMatchObject({
      bottomDockMode: "hidden",
      title: "Tasks",
    })
    expect(mergeAppFrameSlots({}).bottomDockMode).toBe("default")
    expect(mergeAppFrameSlots(undefined).bottomDockMode).toBe("default")
  })

  test("app frame provider layers page-owned slots over route-owned loader slots", () => {
    const providerSource = readFileSync(
      join(process.cwd(), "src/app/frame/AppFrameProvider.tsx"),
      "utf8",
    )

    expect(providerSource).toContain("slotResetKey")
    expect(providerSource).toContain("pageSlots")
    expect(providerSource).toContain("{ ...mergeAppFrameSlots(slots), ...pageSlots }")
    expect(providerSource).toContain("clearSlots: () => setPageSlots({})")
    expect(providerSource).toContain(
      "setSlots: (nextSlots: AppFrameSlots) => setPageSlots(nextSlots)",
    )
    expect(providerSource).not.toContain("setActiveSlots(mergeAppFrameSlots(slots))")
  })

  test("route slot effects use layout timing to avoid post-paint header changes", () => {
    const slotSource = readFileSync(join(process.cwd(), "src/app/frame/app-frame-slots.ts"), "utf8")

    expect(slotSource).toContain("useIsomorphicLayoutEffect")
    expect(slotSource).toContain("useLayoutEffect")
    expect(slotSource).toContain("useIsomorphicLayoutEffect(() =>")
  })

  test("route slots can opt out of business content padding", () => {
    expect(defaultAppFrameSlots.contentPadding).toBe("default")
    expect(mergeAppFrameSlots({ contentPadding: "none", title: "Tasks" })).toMatchObject({
      contentPadding: "none",
      title: "Tasks",
    })
    expect(mergeAppFrameSlots({}).contentPadding).toBe("default")
  })

  test("selects the highest priority app frame banner", () => {
    expect(useAppFrameBannerEffect).toBeTypeOf("function")
    expect(
      selectAppFrameBanner([
        { body: "Lower", id: "one", priority: 10, severity: "info", title: "Lower" },
        { body: "Higher", id: "two", priority: 100, severity: "warning", title: "Higher" },
      ]),
    ).toMatchObject({ id: "two", title: "Higher" })
  })
})
