import type { ReactNode } from "react"

import { cn } from "../../shared/ui/cn"

export function AppFrameHeader({
  children,
  className,
  end,
  start,
}: {
  children?: ReactNode
  className?: string
  end?: ReactNode
  start?: ReactNode
}) {
  return (
    <header className={cn("flex h-11 shrink-0 items-center justify-between gap-3 px-4", className)}>
      <div className="flex min-w-0 items-center gap-2">{start ?? children}</div>
      {end ? <div className="flex shrink-0 items-center gap-2">{end}</div> : null}
    </header>
  )
}
