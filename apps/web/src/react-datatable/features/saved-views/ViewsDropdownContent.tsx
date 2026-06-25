/**
 * ViewsDropdownContent Component
 *
 * Dropdown content with search and view list.
 * Renders Create New View button and filtered view items.
 */

import { Button } from "../../components/ui/button"
import { PlusIcon } from "../../components/ui/icons"
import {
  ViewsDropdownMenuContent,
  ViewsDropdownMenuSection,
  ViewsDropdownMenuSeparator,
} from "../../components/ui/views-dropdown-menu"
import { cn } from "../../shared/utils/cn"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"
import { isReadonlyDatatableView } from "../../state/saved-views/use-datatable-views"
import { ViewItem } from "./ViewItem"
import { useViewsContext } from "./ViewsContext"

interface ViewsDropdownContentProps {
  views: DatatableView[]
  activeView: DatatableView | null
  isLoading: boolean
  isDirty: boolean
  canShare: boolean
  canSetDefaults: boolean
  currentUserId: string
  isUpdating: boolean
  onApplyView: (viewId: string) => void
  onShareView: (viewId: string) => void
  onSetUserDefault: (viewId: string | null) => void
  onSetWorkspaceDefault: (viewId: string | null) => void
  onUpdateView: () => void
}

export function groupDatatableViewsForDropdown(views: DatatableView[]): {
  fixed: DatatableView[]
  private: DatatableView[]
  workspace: DatatableView[]
} {
  return {
    fixed: views.filter(isReadonlyDatatableView),
    private: views.filter(
      (view) =>
        !isReadonlyDatatableView(view) &&
        !view.isShared &&
        !view.isWorkspaceDefault &&
        !view.isUserDefault,
    ),
    workspace: views.filter(
      (view) =>
        !isReadonlyDatatableView(view) &&
        (view.isShared || view.isWorkspaceDefault || view.isUserDefault),
    ),
  }
}

export function ViewsDropdownContent({
  views,
  activeView,
  isLoading,
  isDirty,
  canShare,
  canSetDefaults,
  currentUserId,
  isUpdating,
  onApplyView,
  onShareView,
  onSetUserDefault,
  onSetWorkspaceDefault,
  onUpdateView,
}: ViewsDropdownContentProps) {
  const {
    searchValue,
    setSearchValue,
    searchInputRef,
    handleKeyDown,
    isItemFocused,
    setIsCreateDialogOpen,
    setRenameDialogViewId,
    setDeleteDialogViewId,
    openMenuForViewId,
    setOpenMenuForViewId,
    setIsSubmenuOpen,
    setIsDropdownOpen,
  } = useViewsContext()

  const groupedViews = groupDatatableViewsForDropdown(views)

  // Filter views based on search
  const filteredViews = {
    fixed: searchValue
      ? groupedViews.fixed.filter((v) => v.name.toLowerCase().includes(searchValue.toLowerCase()))
      : groupedViews.fixed,
    private: searchValue
      ? groupedViews.private.filter((v) => v.name.toLowerCase().includes(searchValue.toLowerCase()))
      : groupedViews.private,
    workspace: searchValue
      ? groupedViews.workspace.filter((v) =>
          v.name.toLowerCase().includes(searchValue.toLowerCase()),
        )
      : groupedViews.workspace,
  }

  const hasViews = views.length > 0
  const hasFilteredResults =
    filteredViews.fixed.length > 0 ||
    filteredViews.private.length > 0 ||
    filteredViews.workspace.length > 0
  const openCreateDialog = () => {
    setIsDropdownOpen(false)
    setOpenMenuForViewId(null)
    setIsSubmenuOpen(false)
    setIsCreateDialogOpen(true)
  }

  return (
    <ViewsDropdownMenuContent
      align="end"
      className="z-[90] w-80"
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder="Search views..."
      searchInputRef={searchInputRef}
      onSearchKeyDown={handleKeyDown}
    >
      <div className="flex flex-col">
        {/* Create new view button */}
        <div className="px-0">
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            className={cn(
              "h-9 w-full justify-start px-1 text-xs outline-none",
              isItemFocused("create-button") && "bg-accent/50 text-accent-foreground",
            )}
            onClick={openCreateDialog}
            aria-label="Create new view from current table state"
          >
            <PlusIcon className="mr-1 size-4" />
            Create new view
          </Button>
        </div>

        {hasViews && <ViewsDropdownMenuSeparator />}

        {/* Loading state */}
        {isLoading && (
          <div className="text-muted-foreground px-3 py-8 text-center text-xs">
            Loading views...
          </div>
        )}

        {/* Empty state - no views at all */}
        {!isLoading && !hasViews && (
          <div className="text-muted-foreground px-3 py-8 text-center text-xs">
            No saved views yet. Create one to get started.
          </div>
        )}

        {/* No search results */}
        {!isLoading && hasViews && searchValue && !hasFilteredResults && (
          <div className="text-muted-foreground px-3 py-8 text-center text-xs">No views found</div>
        )}

        {/* Fixed views section */}
        {!isLoading && filteredViews.fixed.length > 0 && (
          <>
            <ViewsDropdownMenuSection>Fixed</ViewsDropdownMenuSection>
            {filteredViews.fixed.map((view) => (
              <ViewItem
                key={view.id}
                view={view}
                isActive={activeView?.id === view.id}
                isMainFocused={isItemFocused(`view-${view.id}-main`)}
                isMenuButtonFocused={isItemFocused(`view-${view.id}-menu`)}
                isUpdateButtonFocused={isItemFocused(`view-${view.id}-update`)}
                isSaveAsButtonFocused={isItemFocused(`view-${view.id}-save-as`)}
                shouldOpenMenu={openMenuForViewId === view.id}
                onMenuOpenChange={(isOpen) => {
                  setIsSubmenuOpen(isOpen)
                  if (!isOpen) {
                    setOpenMenuForViewId(null)
                  }
                }}
                canShare={canShare}
                canSetDefaults={canSetDefaults}
                isOwnView={false}
                onApply={() => {
                  onApplyView(view.id)
                  setIsDropdownOpen(false)
                }}
                onShare={() => onShareView(view.id)}
                onSetUserDefault={() => onSetUserDefault(view.isUserDefault ? null : view.id)}
                onSetWorkspaceDefault={() =>
                  onSetWorkspaceDefault(view.isWorkspaceDefault ? null : view.id)
                }
                isDirty={isDirty && activeView?.id === view.id}
                onUpdate={() => {
                  onUpdateView()
                  setIsDropdownOpen(false)
                }}
                onSaveAsNew={openCreateDialog}
                isUpdating={isUpdating}
              />
            ))}
          </>
        )}

        {/* Private views section */}
        {!isLoading && filteredViews.private.length > 0 && (
          <>
            {filteredViews.fixed.length > 0 && <ViewsDropdownMenuSeparator />}
            <ViewsDropdownMenuSection>Private</ViewsDropdownMenuSection>
            {filteredViews.private.map((view) => (
              <ViewItem
                key={view.id}
                view={view}
                isActive={activeView?.id === view.id}
                isMainFocused={isItemFocused(`view-${view.id}-main`)}
                isMenuButtonFocused={isItemFocused(`view-${view.id}-menu`)}
                isUpdateButtonFocused={isItemFocused(`view-${view.id}-update`)}
                isSaveAsButtonFocused={isItemFocused(`view-${view.id}-save-as`)}
                shouldOpenMenu={openMenuForViewId === view.id}
                onMenuOpenChange={(isOpen) => {
                  setIsSubmenuOpen(isOpen)
                  if (!isOpen) {
                    setOpenMenuForViewId(null)
                  }
                }}
                canShare={canShare}
                canSetDefaults={canSetDefaults}
                isOwnView={view.createdBy === currentUserId}
                onApply={() => {
                  onApplyView(view.id)
                  setIsDropdownOpen(false)
                }}
                onShare={() => onShareView(view.id)}
                onSetUserDefault={() => onSetUserDefault(view.isUserDefault ? null : view.id)}
                onSetWorkspaceDefault={() =>
                  onSetWorkspaceDefault(view.isWorkspaceDefault ? null : view.id)
                }
                onOpenRenameDialog={() => {
                  setOpenMenuForViewId(null)
                  setIsSubmenuOpen(false)
                  setIsDropdownOpen(false)
                  // Wait for dropdown to close before opening dialog
                  setTimeout(() => {
                    setRenameDialogViewId(view.id)
                  }, 100)
                }}
                onOpenDeleteDialog={() => {
                  setOpenMenuForViewId(null)
                  setIsSubmenuOpen(false)
                  setIsDropdownOpen(false)
                  // Wait for dropdown to close before opening dialog
                  setTimeout(() => {
                    setDeleteDialogViewId(view.id)
                  }, 100)
                }}
                isDirty={isDirty && activeView?.id === view.id}
                onUpdate={() => {
                  onUpdateView()
                  setIsDropdownOpen(false)
                }}
                onSaveAsNew={openCreateDialog}
                isUpdating={isUpdating}
              />
            ))}
          </>
        )}

        {/* Workspace views section */}
        {!isLoading && filteredViews.workspace.length > 0 && (
          <>
            {(filteredViews.fixed.length > 0 || filteredViews.private.length > 0) && (
              <ViewsDropdownMenuSeparator />
            )}
            <ViewsDropdownMenuSection>Workspace</ViewsDropdownMenuSection>
            {filteredViews.workspace.map((view) => (
              <ViewItem
                key={view.id}
                view={view}
                isActive={activeView?.id === view.id}
                isMainFocused={isItemFocused(`view-${view.id}-main`)}
                isMenuButtonFocused={isItemFocused(`view-${view.id}-menu`)}
                isUpdateButtonFocused={isItemFocused(`view-${view.id}-update`)}
                isSaveAsButtonFocused={isItemFocused(`view-${view.id}-save-as`)}
                shouldOpenMenu={openMenuForViewId === view.id}
                onMenuOpenChange={(isOpen) => {
                  setIsSubmenuOpen(isOpen)
                  if (!isOpen) {
                    setOpenMenuForViewId(null)
                  }
                }}
                canShare={canShare}
                canSetDefaults={canSetDefaults}
                isOwnView={view.createdBy === currentUserId}
                onApply={() => {
                  onApplyView(view.id)
                  setIsDropdownOpen(false)
                }}
                onShare={() => onShareView(view.id)}
                onSetUserDefault={() => onSetUserDefault(view.isUserDefault ? null : view.id)}
                onSetWorkspaceDefault={() =>
                  onSetWorkspaceDefault(view.isWorkspaceDefault ? null : view.id)
                }
                onOpenRenameDialog={() => {
                  setOpenMenuForViewId(null)
                  setIsSubmenuOpen(false)
                  setIsDropdownOpen(false)
                  // Wait for dropdown to close before opening dialog
                  setTimeout(() => {
                    setRenameDialogViewId(view.id)
                  }, 100)
                }}
                onOpenDeleteDialog={() => {
                  setOpenMenuForViewId(null)
                  setIsSubmenuOpen(false)
                  setIsDropdownOpen(false)
                  // Wait for dropdown to close before opening dialog
                  setTimeout(() => {
                    setDeleteDialogViewId(view.id)
                  }, 100)
                }}
                isDirty={isDirty && activeView?.id === view.id}
                onUpdate={() => {
                  onUpdateView()
                  setIsDropdownOpen(false)
                }}
                onSaveAsNew={openCreateDialog}
                isUpdating={isUpdating}
              />
            ))}
          </>
        )}
      </div>
    </ViewsDropdownMenuContent>
  )
}
