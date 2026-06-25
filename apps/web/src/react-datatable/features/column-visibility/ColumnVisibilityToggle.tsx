"use client"

import { Button } from "../../components/ui/button"
import { cn } from "../../shared/utils/cn"

interface ColumnVisibilityToggleProps {
  label: string
  isVisible: boolean
  onClick: () => void
}

/**
 * Column Visibility Toggle Button
 * Styled button that shows selected/unselected state for column visibility
 */
export const ColumnVisibilityToggle = ({
  label,
  isVisible,
  onClick,
}: ColumnVisibilityToggleProps) => {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-6 justify-start rounded-full px-2.5 !text-xs font-normal",
        isVisible
          ? "border-border text-foreground bg-transparent"
          : "bg-accent/5 border-border/30 text-muted-foreground hover:bg-accent/10 hover:border-border/50",
      )}
    >
      {label}
    </Button>
  )
}
