import type { ReactNode } from "react"

import { selectAppFrameBanner, useAppFrameBanners } from "./app-frame-banners"

export function AppFrameHeightBanner({ children }: { children?: ReactNode }) {
  const banners = useAppFrameBanners()
  const banner = selectAppFrameBanner(banners)
  const content = children ?? banner?.content

  if (!content && !banner) return null

  return (
    <div
      className="shrink-0 border-b border-border bg-background px-4 py-2 text-sm text-foreground"
      data-slot="frame-height-banner"
    >
      {content ?? (
        <div className="flex items-center gap-2">
          <span className="font-medium">{banner?.title}</span>
          {banner?.body ? <span className="text-muted-foreground">{banner.body}</span> : null}
        </div>
      )}
    </div>
  )
}
