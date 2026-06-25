/**
 * ViewItem Component
 *
 * Individual saved view list item with actions.
 * Clean, minimal design matching FilterItem pattern.
 */

import { useEffect, useMemo, useState } from "react"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { CheckIcon, MoreHorizontalIcon } from "../../components/ui/icons"
import { cn } from "../../shared/utils/cn"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"
import { isReadonlyDatatableView } from "../../state/saved-views/use-datatable-views"

interface ViewItemProps {
  view: DatatableView
  isActive: boolean
  isSelected?: boolean
  canShare: boolean
  canSetDefaults: boolean
  isOwnView: boolean
  onApply: () => void
  onShare?: () => void
  onSetUserDefault?: () => void
  onSetWorkspaceDefault?: () => void
  onOpenRenameDialog?: () => void
  onOpenDeleteDialog?: () => void
  isDirty?: boolean
  onUpdate?: () => void
  onSaveAsNew?: () => void
  isUpdating?: boolean
  /** Whether the main area is keyboard focused */
  isMainFocused?: boolean
  /** Whether the menu button is keyboard focused */
  isMenuButtonFocused?: boolean
  /** Whether the update button is keyboard focused */
  isUpdateButtonFocused?: boolean
  /** Whether the save-as button is keyboard focused */
  isSaveAsButtonFocused?: boolean
  /** Whether to open the menu (triggered by keyboard) */
  shouldOpenMenu?: boolean
  /** Callback when menu open state changes */
  onMenuOpenChange?: (isOpen: boolean) => void
}

export function ViewItem({
  view,
  isActive,
  isSelected = false,
  canShare,
  canSetDefaults,
  isOwnView,
  onApply,
  onShare,
  onSetUserDefault,
  onSetWorkspaceDefault,
  onOpenRenameDialog,
  onOpenDeleteDialog,
  isDirty = false,
  onUpdate,
  onSaveAsNew,
  isUpdating = false,
  isMainFocused = false,
  isMenuButtonFocused = false,
  isUpdateButtonFocused = false,
  isSaveAsButtonFocused = false,
  shouldOpenMenu = false,
  onMenuOpenChange,
}: ViewItemProps) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false)

  const isReadonly = isReadonlyDatatableView(view)
  const showActions = !isReadonly && (isOwnView || canSetDefaults)

  // Context menu actions
  const actions = useMemo(() => {
    const allActions = [
      {
        id: "share",
        label: "Share with workspace",
        show: canShare && !view.isShared && isOwnView,
        onClick: () => {
          onShare?.()
          setContextMenuOpen(false)
        },
      },
      {
        id: "rename",
        label: "Rename",
        show: isOwnView && !!onOpenRenameDialog,
        onClick: () => {
          setContextMenuOpen(false)
          if (onMenuOpenChange) {
            onMenuOpenChange(false)
          }
          if (onOpenRenameDialog) {
            onOpenRenameDialog()
          }
        },
      },
      {
        id: "setUserDefault",
        label: view.isUserDefault ? "Unset as default" : "Set as my default",
        show: canSetDefaults,
        onClick: () => {
          onSetUserDefault?.()
          setContextMenuOpen(false)
        },
      },
      {
        id: "setWorkspaceDefault",
        label: view.isWorkspaceDefault ? "Unset workspace default" : "Set workspace default",
        show: canShare && view.isShared,
        onClick: () => {
          onSetWorkspaceDefault?.()
          setContextMenuOpen(false)
        },
      },
      {
        id: "delete",
        label: "Delete view",
        show: isOwnView && !!onOpenDeleteDialog,
        onClick: () => {
          setContextMenuOpen(false)
          if (onMenuOpenChange) {
            onMenuOpenChange(false)
          }
          if (onOpenDeleteDialog) {
            onOpenDeleteDialog()
          }
        },
      },
    ]

    return allActions.filter((action) => action.show)
  }, [
    canShare,
    canSetDefaults,
    isOwnView,
    view.isShared,
    view.isUserDefault,
    view.isWorkspaceDefault,
    onShare,
    onOpenRenameDialog,
    onOpenDeleteDialog,
    onSetUserDefault,
    onSetWorkspaceDefault,
    onMenuOpenChange,
  ])

  const isDefaultView = view.isUserDefault || view.isWorkspaceDefault

  // Open menu when triggered by keyboard
  useEffect(() => {
    if (shouldOpenMenu) {
      setContextMenuOpen(true)
    }
  }, [shouldOpenMenu])

  return (
    <div className="flex flex-col items-stretch group text-xs">
      {/* First row: Checkmark, View name, (Default) badge, Three-dot menu */}
      <div
        className={cn(
          "flex items-center gap-2 w-full rounded-sm px-2 py-1.5",
          "hover:bg-accent",
          (isSelected || isMainFocused) && "bg-accent/50 text-accent-foreground",
        )}
      >
        {/* Main clickable area - checkmark + name + badge */}
        <button
          type="button"
          tabIndex={-1}
          className="flex items-center gap-2 flex-1 min-w-0 text-left outline-none rounded-sm"
          onClick={onApply}
          aria-label={`Apply view: ${view.name}`}
        >
          {/* Checkmark for active view */}
          <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
            {isActive && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
          </div>

          {/* View name - truncates when badge present */}
          <span className="truncate font-medium flex-1 min-w-0">{view.name}</span>

          {/* Default badge */}
          {isDefaultView && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 shrink-0 text-muted-foreground border-muted"
            >
              Default
            </Badge>
          )}
        </button>

        {/* Three-dot actions menu */}
        {showActions && (
          <div
            className={cn(
              "transition-opacity shrink-0",
              isMenuButtonFocused || isMainFocused
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            )}
          >
            <DropdownMenu
              open={contextMenuOpen}
              onOpenChange={(open) => {
                setContextMenuOpen(open)
                // Notify parent when menu state changes
                if (onMenuOpenChange) {
                  onMenuOpenChange(open)
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  tabIndex={-1}
                  className={cn(
                    "h-5 w-5 p-0 outline-none",
                    isMenuButtonFocused && "ring-2 ring-primary ring-offset-1",
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  aria-label={`View actions for ${view.name}`}
                  title="View actions"
                >
                  <MoreHorizontalIcon className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="z-[110] w-48"
                align="end"
                onKeyDown={(e) => {
                  e.stopPropagation()
                }}
              >
                {actions.length === 0 ? (
                  <div className="px-2 py-8 text-center text-xs text-muted-foreground">
                    No actions found
                  </div>
                ) : (
                  actions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.onClick()
                      }}
                      className="text-xs"
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Second row: Unsaved changes actions - shown when active and dirty */}
      {isActive && isDirty && (
        <div className="flex items-center justify-between gap-2 w-full pl-5.5 pt-1 text-[11px] text-primary">
          <span className="text-muted-foreground">Unsaved changes</span>
          <div className="flex items-center gap-1">
            {!isReadonly && isOwnView && onUpdate && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdate()
                }}
                disabled={isUpdating}
                className={cn(
                  "px-1.5 py-0.5 hover:underline disabled:opacity-50 outline-none rounded-sm",
                  isUpdateButtonFocused && "ring-2 ring-primary ring-offset-1",
                )}
                aria-label="Update current view with changes"
              >
                {isUpdating ? "Updating..." : "Update"}
              </button>
            )}
            {onSaveAsNew && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onSaveAsNew()
                }}
                className={cn(
                  "px-1.5 py-0.5 hover:underline outline-none rounded-sm",
                  isSaveAsButtonFocused && "ring-2 ring-primary ring-offset-1",
                )}
                aria-label="Save as new view"
              >
                Save as
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
