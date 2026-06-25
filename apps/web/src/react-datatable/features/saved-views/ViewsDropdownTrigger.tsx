/**
 * ViewsDropdownTrigger Component
 *
 * Button that triggers the views dropdown menu.
 * Shows active view name and dirty state indicator.
 */

import { Button } from "../../components/ui/button"
import { BookmarkSimpleIcon } from "../../components/ui/icons"
import { ViewsDropdownMenuTrigger } from "../../components/ui/views-dropdown-menu"

interface ViewsDropdownTriggerProps {
  activeViewName?: string
  isDirty: boolean
}

export function ViewsDropdownTrigger({ activeViewName, isDirty }: ViewsDropdownTriggerProps) {
  return (
    <ViewsDropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="xs"
        className="relative flex min-w-0 max-w-[8.5rem] items-center gap-1.5 rounded-full px-2"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <BookmarkSimpleIcon className="h-3 w-3 shrink-0" />
          <span
            className={
              activeViewName ? "truncate text-xs text-muted-foreground" : "truncate text-xs"
            }
          >
            {activeViewName || "Views"}
          </span>
          {isDirty && activeViewName && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full border border-background bg-red-500"></span>
          )}
        </div>
      </Button>
    </ViewsDropdownMenuTrigger>
  )
}
