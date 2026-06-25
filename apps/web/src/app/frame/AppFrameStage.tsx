import type { ReactNode } from "react"

export function AppFrameStage({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-sidebar">
      {sidebar}
      {children}
    </div>
  )
}
