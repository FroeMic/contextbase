import type { ReactNode } from "react"

export function AppFrameViewport({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden bg-sidebar text-foreground">
      {children}
    </div>
  )
}
