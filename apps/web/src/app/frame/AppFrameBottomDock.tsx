import type { ReactNode } from "react"

import { FeatureFlagOverrideDockButton } from "../../domains/feature-flags/client/FeatureFlagOverrideDockButton"
import { cn } from "../../shared/ui/cn"
import { AppThemeToggle } from "../theme/AppThemeToggle"
import type { AppFrameBottomDockMode } from "./app-frame-slots"

export function AppFrameBottomDock({
  children,
  end,
  mode = "default",
}: {
  children?: ReactNode
  end?: ReactNode
  mode?: AppFrameBottomDockMode
}) {
  if (mode === "hidden") return null

  return (
    <div className={resolveBottomDockClassName(mode)} data-slot="app-frame-bottom-dock">
      {children}
      <div className="ml-auto flex items-center gap-1">
        {end}
        <AppThemeToggle />
        <FeatureFlagOverrideDockButton />
      </div>
    </div>
  )
}

export function resolveBottomDockClassName(mode: AppFrameBottomDockMode) {
  return cn(
    mode === "hidden" && "hidden",
    mode === "default" &&
      "flex h-7 w-full shrink-0 items-center justify-start gap-2 pt-1 text-sm text-muted-foreground",
  )
}
