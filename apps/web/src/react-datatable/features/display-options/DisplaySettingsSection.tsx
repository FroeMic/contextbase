"use client"

import { useId } from "react"
import { Label } from "../../components/ui/label"
import { Switch } from "../../components/ui/switch"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableDisplayOptionsConfig } from "../../types/props.types"

/**
 * Display Settings Section
 * Miscellaneous display toggles (show headers, etc.)
 */
interface DisplaySettingsSectionProps {
  config?: DatatableDisplayOptionsConfig
  variant?: "default" | "mobile"
}

export const DisplaySettingsSection = ({
  config,
  variant = "default",
}: DisplaySettingsSectionProps) => {
  const orderingBadgeId = useId()
  const columnHeadersId = useId()
  const emptyGroupsId = useId()
  const showColumnHeaders = useDatatableStore((s) => s.showColumnHeaders)
  const showEmptyGroups = useDatatableStore((s) => s.showEmptyGroups)
  const showOrderingBadge = useDatatableStore((s) => s.showOrderingBadge)
  const setState = useDatatableStore((s) => s.setState)
  const showEmptyGroupsControl = config?.controls?.showEmptyGroups !== false
  const showOrderingBadgeControl = config?.controls?.showOrderingBadge !== false

  const handleToggleOrderingBadge = (checked: boolean) => {
    setState({ showOrderingBadge: checked })
  }

  const handleToggleHeaders = (checked: boolean) => {
    setState({ showColumnHeaders: checked })
  }

  const handleToggleEmptyGroups = (checked: boolean) => {
    setState({ showEmptyGroups: checked })
  }

  return (
    <div className={cn("space-y-2.5", variant === "mobile" && "space-y-3")}>
      <div className="pb-0.5">
        <Label
          className={cn(
            "text-muted-foreground text-xs font-medium",
            variant === "mobile" && "text-sm",
          )}
        >
          Display Settings
        </Label>
      </div>

      {showOrderingBadgeControl && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={orderingBadgeId}
            className={cn("cursor-pointer text-xs font-normal", variant === "mobile" && "text-sm")}
          >
            Show order indicator
          </Label>
          <Switch
            id={orderingBadgeId}
            size="sm"
            checked={showOrderingBadge}
            onCheckedChange={handleToggleOrderingBadge}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label
          htmlFor={columnHeadersId}
          className={cn("cursor-pointer text-xs font-normal", variant === "mobile" && "text-sm")}
        >
          Show column headers
        </Label>
        <Switch
          id={columnHeadersId}
          size="sm"
          checked={showColumnHeaders}
          onCheckedChange={handleToggleHeaders}
        />
      </div>

      {showEmptyGroupsControl && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={emptyGroupsId}
            className={cn("cursor-pointer text-xs font-normal", variant === "mobile" && "text-sm")}
          >
            Show empty groups
          </Label>
          <Switch
            id={emptyGroupsId}
            size="sm"
            checked={showEmptyGroups}
            onCheckedChange={handleToggleEmptyGroups}
          />
        </div>
      )}
    </div>
  )
}
