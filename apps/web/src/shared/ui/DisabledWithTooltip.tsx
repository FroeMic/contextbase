import type { ReactNode } from "react"

import { cn } from "@/shared/ui/cn"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip"

export function DisabledWithTooltip({
  children,
  className,
  tooltip,
}: {
  children: ReactNode
  className?: string
  tooltip: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span aria-disabled="true" className={cn("inline-flex min-w-0", className)} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
