import type { DependencyList, ReactNode } from "react"
import { createContext, useContext, useEffect } from "react"

export type AppFrameBanner = {
  body?: ReactNode
  content?: ReactNode
  id: string
  priority: number
  severity: "critical" | "info" | "warning"
  title: ReactNode
}

export const AppFrameBannersContext = createContext<readonly AppFrameBanner[]>([])

export const AppFrameBannerActionsContext = createContext<{
  clearBanner: (id: string) => void
  setBanner: (banner: AppFrameBanner) => void
} | null>(null)

export function useAppFrameBanners() {
  return useContext(AppFrameBannersContext)
}

export function selectAppFrameBanner(banners: readonly AppFrameBanner[]) {
  return banners.reduce<AppFrameBanner | null>((selected, banner) => {
    if (!selected) return banner
    return banner.priority > selected.priority ? banner : selected
  }, null)
}

export function useAppFrameBannerEffect(
  banner: AppFrameBanner | null,
  dependencies: DependencyList = [],
) {
  const actions = useContext(AppFrameBannerActionsContext)

  // biome-ignore lint/correctness/useExhaustiveDependencies: route banner callers pass explicit dependencies that identify the mounted route state.
  useEffect(() => {
    if (!banner) return

    actions?.setBanner(banner)

    return () => {
      actions?.clearBanner(banner.id)
    }
  }, [actions, ...dependencies])
}
