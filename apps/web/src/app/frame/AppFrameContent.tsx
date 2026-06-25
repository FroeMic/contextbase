import type { ReactNode } from "react"

export function AppFrameContent({ children }: { children: ReactNode }) {
  return <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
}
