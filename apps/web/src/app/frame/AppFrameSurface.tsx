import type { ReactNode } from "react"

export function AppFrameSurface({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
      {children}
    </section>
  )
}
