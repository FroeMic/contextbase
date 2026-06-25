/**
 * DatatableViewDropdown Component
 *
 * Root component for saved views dropdown with dialogs.
 * Renders dropdown trigger, content, and all dialogs as siblings.
 * Uses ViewsContext for state coordination.
 */

import { useCallback, useMemo } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { DatatableMobileDrawerNavigator } from "../../components/mobile/DatatableMobileDrawerNavigator"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { BookmarkSimpleIcon, WarningIcon } from "../../components/ui/icons"
import { ViewsDropdownMenu } from "../../components/ui/views-dropdown-menu"
import { useDatatableViewsContext } from "../../core/DatatableProvider"
import {
  type UseDatatableViewsState,
  useDatatableViews,
} from "../../state/saved-views/use-datatable-views"
import { CreateViewDialog } from "./CreateViewDialog"
import { DeleteViewDialog } from "./DeleteViewDialog"
import {
  useMobileViewsDrawerPages,
  VIEWS_DRAWER_INITIAL_PAGE,
  VIEWS_DRAWER_INITIAL_PARAMS,
  type ViewsDrawerPageId,
  type ViewsDrawerPageParams,
} from "./MobileViewsDrawerContent"
import { RenameViewDialog } from "./RenameViewDialog"
import type { DatatableViewDropdownProps } from "./types"
import { useViewsContext, ViewsContextProvider } from "./ViewsContext"
import { groupDatatableViewsForDropdown, ViewsDropdownContent } from "./ViewsDropdownContent"
import { ViewsDropdownTrigger } from "./ViewsDropdownTrigger"

/**
 * Internal component that consumes ViewsContext
 */
function DatatableViewDropdownInner<TData>({
  viewsConfig,
  viewsState,
  currentUserId = "default",
}: {
  viewsConfig: DatatableViewDropdownProps<TData>["viewsConfig"]
  viewsState: UseDatatableViewsState
  currentUserId?: string
}) {
  const {
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    renameDialogViewId,
    setRenameDialogViewId,
    deleteDialogViewId,
    setDeleteDialogViewId,
    isDropdownOpen,
    setIsDropdownOpen,
    resetFocus,
    setSearchValue,
  } = useViewsContext()

  const {
    views,
    isLoading,
    activeView,
    isDirty,
    canShare,
    canSetDefaults,
    applyView,
    createViewFromCurrentState,
    deleteView: deleteViewMutation,
    shareView,
    setUserDefault,
    setWorkspaceDefault,
    updateActiveViewWithCurrentState,
    updateView,
    isCreating,
    isUpdating,
  } = viewsState
  const canUseWorkspaceFeatures = viewsConfig?.enableWorkspaceSharing !== false
  const canUseUserDefaults = viewsConfig?.enableUserDefaults !== false
  const isMobile = useIsMobile()
  const mobilePages = useMobileViewsDrawerPages({
    canSetDefaults: canUseUserDefaults && canSetDefaults,
    canShare: canUseWorkspaceFeatures && canShare,
    currentUserId,
    viewsState,
  })

  // Reset focus and search when dropdown closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setIsDropdownOpen(newOpen)
      if (!newOpen) {
        setSearchValue("")
        resetFocus()
      }
    },
    [setIsDropdownOpen, setSearchValue, resetFocus],
  )

  // Handle rename
  const handleRename = async (newName: string) => {
    if (!renameDialogViewId) {
      return
    }

    await updateView({
      viewId: renameDialogViewId,
      updates: { name: newName },
    })
    setRenameDialogViewId(null)
  }

  // Handle delete
  const handleDelete = () => {
    if (!deleteDialogViewId) {
      return
    }

    deleteViewMutation(deleteDialogViewId)
    setDeleteDialogViewId(null)
  }

  if (isMobile) {
    return (
      <>
        <Button
          aria-expanded={isDropdownOpen}
          className="relative flex h-9 min-w-0 max-w-[9.5rem] items-center gap-1.5 rounded-full px-3.5 text-sm"
          onClick={() => handleOpenChange(true)}
          size="xs"
          variant="outline"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <BookmarkSimpleIcon className="h-3 w-3 shrink-0" />
            <span
              className={
                activeView?.name ? "truncate text-sm text-muted-foreground" : "truncate text-sm"
              }
            >
              {activeView?.name || "Views"}
            </span>
            {isDirty && activeView?.name && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full border border-background bg-red-500" />
            )}
          </div>
        </Button>
        <DatatableMobileDrawerNavigator<ViewsDrawerPageId, ViewsDrawerPageParams>
          initialPage={VIEWS_DRAWER_INITIAL_PAGE}
          initialParams={VIEWS_DRAWER_INITIAL_PARAMS}
          onOpenChange={handleOpenChange}
          open={isDropdownOpen}
          pages={mobilePages}
        />
      </>
    )
  }

  return (
    <>
      {/* Dropdown Menu */}
      <ViewsDropdownMenu open={isDropdownOpen} onOpenChange={handleOpenChange}>
        <ViewsDropdownTrigger activeViewName={activeView?.name} isDirty={isDirty} />
        <ViewsDropdownContent
          views={views}
          activeView={activeView}
          isLoading={isLoading}
          isDirty={isDirty}
          canShare={canUseWorkspaceFeatures && canShare}
          canSetDefaults={canUseUserDefaults && canSetDefaults}
          currentUserId={currentUserId}
          isUpdating={isUpdating}
          onApplyView={applyView}
          onShareView={shareView}
          onSetUserDefault={setUserDefault}
          onSetWorkspaceDefault={setWorkspaceDefault}
          onUpdateView={updateActiveViewWithCurrentState}
        />
      </ViewsDropdownMenu>

      {/* Dialogs - always rendered, never unmounted */}
      <CreateViewDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateView={createViewFromCurrentState}
        canSetDefaults={canSetDefaults}
        isCreating={isCreating}
      />

      <RenameViewDialog
        open={renameDialogViewId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameDialogViewId(null)
            // Manual cleanup of pointer-events after dialog closes
            setTimeout(() => {
              document.body.style.pointerEvents = ""
            }, 50)
          }
        }}
        viewId={renameDialogViewId}
        views={views}
        onRename={handleRename}
        isRenaming={isUpdating}
      />

      <DeleteViewDialog
        open={deleteDialogViewId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogViewId(null)
            // Manual cleanup of pointer-events after dialog closes
            setTimeout(() => {
              document.body.style.pointerEvents = ""
            }, 50)
          }
        }}
        viewId={deleteDialogViewId}
        views={views}
        onConfirm={handleDelete}
      />
    </>
  )
}

/**
 * Root component with ViewsContext provider
 */
export function DatatableViewDropdown<TData>({
  viewsConfig,
  currentUserId = "default",
}: DatatableViewDropdownProps<TData>) {
  // If adapter is not configured, show error state early
  if (!viewsConfig?.adapter) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="xs" className="flex items-center gap-1.5 px-2">
            <BookmarkSimpleIcon className="h-3 w-3" />
            <span className="text-xs">Views</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="z-[90] w-64">
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <WarningIcon className="h-4 w-4 text-amber-500" />
            <span>Saved views are not enabled for this table.</span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DatatableViewDropdownWithProvider viewsConfig={viewsConfig} currentUserId={currentUserId} />
  )
}

/**
 * Component with hooks (separated to satisfy rules of hooks)
 */
function DatatableViewDropdownWithProvider<TData>({
  viewsConfig,
  currentUserId,
}: {
  viewsConfig: DatatableViewDropdownProps<TData>["viewsConfig"]
  currentUserId?: string
}) {
  const sharedViewsState = useDatatableViewsContext()

  if (sharedViewsState) {
    return (
      <DatatableViewDropdownWithViews
        viewsConfig={viewsConfig}
        viewsState={sharedViewsState}
        currentUserId={currentUserId}
      />
    )
  }

  return <StandaloneDatatableViewDropdown viewsConfig={viewsConfig} currentUserId={currentUserId} />
}

function StandaloneDatatableViewDropdown<TData>({
  viewsConfig,
  currentUserId,
}: {
  viewsConfig: DatatableViewDropdownProps<TData>["viewsConfig"]
  currentUserId?: string
}) {
  const viewsState = useDatatableViews(viewsConfig ?? {})

  return (
    <DatatableViewDropdownWithViews
      viewsConfig={viewsConfig}
      viewsState={viewsState}
      currentUserId={currentUserId}
    />
  )
}

function DatatableViewDropdownWithViews<TData>({
  viewsConfig,
  viewsState,
  currentUserId,
}: {
  viewsConfig: DatatableViewDropdownProps<TData>["viewsConfig"]
  viewsState: UseDatatableViewsState
  currentUserId?: string
}) {
  const { views, isDirty, activeView, applyView, updateActiveViewWithCurrentState } = viewsState

  // Flat list of all views for keyboard navigation
  const allViews = views
  const viewIds = useMemo(() => allViews.map((v) => v.id), [allViews])

  // Get dirty view IDs
  const dirtyViewIds = useMemo(() => {
    if (!isDirty || !activeView) {
      return []
    }
    return [activeView.id]
  }, [isDirty, activeView])

  // Group views for section detection
  const groupedViews = useMemo(() => {
    return groupDatatableViewsForDropdown(views)
  }, [views])

  const nonEmptySections = [
    groupedViews.fixed.length,
    groupedViews.private.length,
    groupedViews.workspace.length,
  ].filter((count) => count > 0).length
  const hasSections = nonEmptySections > 1

  return (
    <ViewsContextProvider
      viewCount={allViews.length}
      dirtyViewIds={dirtyViewIds}
      viewIds={viewIds}
      onCreateView={() => {
        // Handled by dialog opening
      }}
      onApplyView={applyView}
      onViewAction={(_viewId, action) => {
        if (action === "update") {
          updateActiveViewWithCurrentState()
        }
        // Other actions handled by context state
      }}
      hasSections={hasSections}
    >
      <DatatableViewDropdownInner
        viewsConfig={viewsConfig}
        viewsState={viewsState}
        currentUserId={currentUserId}
      />
    </ViewsContextProvider>
  )
}
