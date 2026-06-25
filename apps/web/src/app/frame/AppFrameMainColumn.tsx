import type { ReactNode } from "react"

export function AppFrameMainColumn({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
}
