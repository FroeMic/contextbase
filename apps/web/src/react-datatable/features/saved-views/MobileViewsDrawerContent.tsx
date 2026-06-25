"use client"

import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react"
import type { DatatableMobileDrawerPageDefinition } from "../../components/mobile/datatable-mobile-drawer-navigation"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
import { CheckIcon, ChevronRightIcon, PlusIcon } from "../../components/ui/icons"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"
import type { UseDatatableViewsState } from "../../state/saved-views/use-datatable-views"
import { useViewsContext } from "./ViewsContext"

export type ViewsDrawerPageId =
  | "root"
  | "view-actions"
  | "create-view"
  | "rename-view"
  | "delete-view"

export type ViewsDrawerPageParams = {
  "create-view": Record<string, never>
  "delete-view": { viewId: string }
  "rename-view": { viewId: string }
  root: Record<string, never>
  "view-actions": { viewId: string }
}

export const VIEWS_DRAWER_INITIAL_PAGE = "root" satisfies ViewsDrawerPageId
export const VIEWS_DRAWER_INITIAL_PARAMS = {} satisfies ViewsDrawerPageParams["root"]
const MOBILE_VIEWS_DRAWER_INPUT_FOCUS_DELAY_MS = 450

type MobileViewsDrawerOptions = {
  canSetDefaults: boolean
  canShare: boolean
  currentUserId: string
  viewsState: UseDatatableViewsState
}

export function useMobileViewsDrawerPages(options: MobileViewsDrawerOptions) {
  return useMemo(
    () =>
      ({
        root: {
          description: () => "Select and manage saved table views.",
          id: "root",
          render: ({ close, push }) => (
            <MobileViewsRootPage close={close} options={options} push={push} />
          ),
          title: () => "Views",
        },
        "view-actions": {
          description: ({ viewId }) => `Actions for saved view ${viewId}.`,
          id: "view-actions",
          render: ({ close, push }, { viewId }) => (
            <MobileViewActionsPage close={close} options={options} push={push} viewId={viewId} />
          ),
          title: ({ viewId }) => (
            <MobileViewTitle viewId={viewId} views={options.viewsState.views} />
          ),
        },
        "create-view": {
          description: () => "Create a saved table view.",
          id: "create-view",
          render: ({ close }) => <MobileCreateViewPage close={close} options={options} />,
          title: () => "Create view",
        },
        "rename-view": {
          description: ({ viewId }) => `Rename saved view ${viewId}.`,
          id: "rename-view",
          render: ({ close }, { viewId }) => (
            <MobileRenameViewPage close={close} options={options} viewId={viewId} />
          ),
          title: () => "Rename view",
        },
        "delete-view": {
          description: ({ viewId }) => `Confirm deletion for saved view ${viewId}.`,
          id: "delete-view",
          render: ({ close, pop }, { viewId }) => (
            <MobileDeleteViewPage close={close} options={options} pop={pop} viewId={viewId} />
          ),
          title: () => "Delete view",
        },
      }) satisfies Record<
        ViewsDrawerPageId,
        DatatableMobileDrawerPageDefinition<ViewsDrawerPageId, ViewsDrawerPageParams>
      >,
    [options],
  )
}

function MobileViewsRootPage({
  close,
  options,
  push,
}: {
  close: () => void
  options: MobileViewsDrawerOptions
  push: <TNextPageId extends ViewsDrawerPageId>(
    pageId: TNextPageId,
    params: ViewsDrawerPageParams[TNextPageId],
  ) => void
}) {
  const { searchValue, setSearchValue } = useViewsContext()
  const { activeView, isDirty, isLoading, isUpdating, updateActiveViewWithCurrentState, views } =
    options.viewsState
  const groupedViews = useMemo(() => groupViews(views, searchValue), [views, searchValue])
  const hasViews = views.length > 0
  const hasFilteredResults = groupedViews.private.length > 0 || groupedViews.workspace.length > 0

  const applyView = (viewId: string) => {
    options.viewsState.applyView(viewId)
    close()
  }

  const renderView = (view: DatatableView) => (
    <MobileViewRow
      activeView={activeView}
      canSetDefaults={options.canSetDefaults}
      close={close}
      currentUserId={options.currentUserId}
      isDirty={isDirty}
      isUpdating={isUpdating}
      key={view.id}
      onApplyView={applyView}
      onSaveAsNew={() => push("create-view", {})}
      onUpdateView={updateActiveViewWithCurrentState}
      pushActions={() => push("view-actions", { viewId: view.id })}
      view={view}
    />
  )

  return (
    <div className="flex min-h-0 flex-col bg-popover">
      <div className="sticky -top-px z-10 -mt-px bg-popover p-2">
        <Input
          aria-label="Search views"
          className={DATATABLE_MOBILE_SEARCH_INPUT_CLASS}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search views..."
          value={searchValue}
        />
      </div>
      <div className="min-h-0 overflow-y-auto p-2">
        <Button
          aria-label="Create new view from current table state"
          className="mb-2 h-10 w-full justify-start gap-2 text-sm"
          onClick={() => push("create-view", {})}
          variant="ghost"
        >
          <PlusIcon className="size-4" />
          Create new view
        </Button>

        {isLoading ? (
          <EmptyViewsState>Loading views...</EmptyViewsState>
        ) : !hasViews ? (
          <EmptyViewsState>No saved views yet. Create one to get started.</EmptyViewsState>
        ) : searchValue && !hasFilteredResults ? (
          <EmptyViewsState>No views found</EmptyViewsState>
        ) : (
          <div className="space-y-3">
            {groupedViews.private.length > 0 && (
              <MobileViewsSection title="Private">
                {groupedViews.private.map(renderView)}
              </MobileViewsSection>
            )}
            {groupedViews.workspace.length > 0 && (
              <MobileViewsSection title="Workspace">
                {groupedViews.workspace.map(renderView)}
              </MobileViewsSection>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MobileViewActionsPage({
  close,
  options,
  push,
  viewId,
}: {
  close: () => void
  options: MobileViewsDrawerOptions
  push: <TNextPageId extends ViewsDrawerPageId>(
    pageId: TNextPageId,
    params: ViewsDrawerPageParams[TNextPageId],
  ) => void
  viewId: string
}) {
  const view = options.viewsState.views.find((candidate) => candidate.id === viewId)
  if (!view) return null

  const isOwnView = view.createdBy === options.currentUserId
  const actions = [
    {
      id: "share",
      label: "Share with workspace",
      onClick: () => {
        options.viewsState.shareView(view.id)
        close()
      },
      show: options.canShare && !view.isShared && isOwnView,
    },
    {
      id: "user-default",
      label: view.isUserDefault ? "Unset as my default" : "Set as my default",
      onClick: () => {
        options.viewsState.setUserDefault(view.isUserDefault ? null : view.id)
        close()
      },
      show: options.canSetDefaults,
    },
    {
      id: "workspace-default",
      label: view.isWorkspaceDefault ? "Unset workspace default" : "Set workspace default",
      onClick: () => {
        options.viewsState.setWorkspaceDefault(view.isWorkspaceDefault ? null : view.id)
        close()
      },
      show: options.canShare && view.isShared,
    },
    {
      id: "rename",
      label: "Rename",
      onClick: () => push("rename-view", { viewId: view.id }),
      show: isOwnView,
    },
    {
      id: "delete",
      label: "Delete view",
      onClick: () => push("delete-view", { viewId: view.id }),
      show: isOwnView,
    },
  ].filter((action) => action.show)

  return (
    <div className="p-2">
      {actions.length === 0 ? (
        <EmptyViewsState>No actions found</EmptyViewsState>
      ) : (
        <div className="space-y-1">
          {actions.map((action) => (
            <button
              className="flex h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              key={action.id}
              onClick={action.onClick}
              type="button"
            >
              <span>{action.label}</span>
              {action.id === "rename" || action.id === "delete" ? (
                <ChevronRightIcon className="size-4 opacity-50" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileCreateViewPage({
  close,
  options,
}: {
  close: () => void
  options: MobileViewsDrawerOptions
}) {
  const [name, setName] = useState("")
  const [isUserDefault, setIsUserDefault] = useState(false)
  const inputRef = useAutofocusInput()
  const nameId = useId()
  const defaultId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    await options.viewsState.createViewFromCurrentState(trimmed, {
      isUserDefault,
    })
    close()
  }

  return (
    <form className="space-y-4 p-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor={nameId}>View name</Label>
        <Input
          disabled={options.viewsState.isCreating}
          id={nameId}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="My custom view"
          ref={inputRef}
          value={name}
        />
      </div>
      {options.canSetDefaults && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isUserDefault}
            disabled={options.viewsState.isCreating}
            id={defaultId}
            onCheckedChange={(checked) => setIsUserDefault(checked === true)}
          />
          <Label className="cursor-pointer text-sm font-normal" htmlFor={defaultId}>
            Set as my default view
          </Label>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          disabled={options.viewsState.isCreating}
          onClick={close}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={!name.trim() || options.viewsState.isCreating} type="submit">
          {options.viewsState.isCreating ? "Creating..." : "Create view"}
        </Button>
      </div>
    </form>
  )
}

function MobileRenameViewPage({
  close,
  options,
  viewId,
}: {
  close: () => void
  options: MobileViewsDrawerOptions
  viewId: string
}) {
  const view = options.viewsState.views.find((candidate) => candidate.id === viewId)
  const currentName = view?.name ?? ""
  const [name, setName] = useState(currentName)
  const inputRef = useAutofocusInput()
  const nameId = useId()

  useEffect(() => {
    setName(currentName)
  }, [currentName])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) return

    await options.viewsState.updateViewAsync({
      viewId,
      updates: { name: trimmed },
    })
    close()
  }

  return (
    <form className="space-y-4 p-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor={nameId}>View name</Label>
        <Input
          disabled={options.viewsState.isUpdating}
          id={nameId}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter view name"
          ref={inputRef}
          value={name}
        />
      </div>
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          disabled={options.viewsState.isUpdating}
          onClick={close}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          disabled={!name.trim() || name.trim() === currentName || options.viewsState.isUpdating}
          type="submit"
        >
          {options.viewsState.isUpdating ? "Renaming..." : "Rename"}
        </Button>
      </div>
    </form>
  )
}

function MobileDeleteViewPage({
  close,
  options,
  pop,
  viewId,
}: {
  close: () => void
  options: MobileViewsDrawerOptions
  pop: () => void
  viewId: string
}) {
  const view = options.viewsState.views.find((candidate) => candidate.id === viewId)
  if (!view) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await options.viewsState.deleteViewAsync(viewId)
    close()
  }

  return (
    <form className="flex min-h-full flex-col p-4" onSubmit={submit}>
      <div className="space-y-2">
        <h3 className="font-heading text-lg font-semibold">Delete saved view?</h3>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete &quot;{view.name}&quot;? This action cannot be undone.
        </p>
        {view.isShared ? (
          <p className="text-sm font-medium text-amber-600">
            This view is shared with your workspace. Deleting it will remove it for everyone.
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex justify-end gap-2 border-t pt-3">
        <Button
          disabled={options.viewsState.isDeleting}
          onClick={pop}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={options.viewsState.isDeleting} type="submit" variant="destructive">
          {options.viewsState.isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </form>
  )
}

function MobileViewRow({
  activeView,
  canSetDefaults,
  close,
  currentUserId,
  isDirty,
  isUpdating,
  onApplyView,
  onSaveAsNew,
  onUpdateView,
  pushActions,
  view,
}: {
  activeView: DatatableView | null
  canSetDefaults: boolean
  close: () => void
  currentUserId: string
  isDirty: boolean
  isUpdating: boolean
  onApplyView: (viewId: string) => void
  onSaveAsNew: () => void
  onUpdateView: () => Promise<unknown>
  pushActions: () => void
  view: DatatableView
}) {
  const isActive = activeView?.id === view.id
  const isOwnView = view.createdBy === currentUserId
  const canShowActions = isOwnView || canSetDefaults

  return (
    <div className="rounded-md">
      <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent">
        <button
          aria-label={`Apply view: ${view.name}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onApplyView(view.id)}
          type="button"
        >
          <span className="flex size-4 shrink-0 items-center justify-center">
            {isActive ? <CheckIcon className="size-4 text-primary" /> : null}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{view.name}</span>
          {view.isUserDefault || view.isWorkspaceDefault ? (
            <Badge className="h-5 shrink-0 px-1.5 text-[10px]" variant="outline">
              Default
            </Badge>
          ) : null}
        </button>
        {canShowActions ? (
          <Button
            aria-label={`View actions for ${view.name}`}
            onClick={pushActions}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        ) : null}
      </div>
      {isActive && isDirty ? (
        <div className="flex items-center justify-between gap-2 pl-8 pr-2 text-[11px]">
          <span className="text-muted-foreground">Unsaved changes</span>
          <div className="flex items-center gap-2 text-primary">
            {isOwnView ? (
              <button
                className="rounded-sm px-1 py-0.5 hover:underline disabled:opacity-50"
                disabled={isUpdating}
                onClick={async () => {
                  await onUpdateView()
                  close()
                }}
                type="button"
              >
                {isUpdating ? "Updating..." : "Update"}
              </button>
            ) : null}
            <button
              className="rounded-sm px-1 py-0.5 hover:underline"
              onClick={onSaveAsNew}
              type="button"
            >
              Save as
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileViewsSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function MobileViewTitle({ viewId, views }: { viewId: string; views: DatatableView[] }) {
  const view = views.find((candidate) => candidate.id === viewId)
  return view?.name ?? "View actions"
}

function EmptyViewsState({ children }: { children: ReactNode }) {
  return <div className="px-3 py-8 text-center text-sm text-muted-foreground">{children}</div>
}

function groupViews(views: DatatableView[], searchValue: string) {
  const query = searchValue.trim().toLowerCase()
  const matches = (view: DatatableView) => !query || view.name.toLowerCase().includes(query)
  return {
    private: views.filter(
      (view) => !view.isShared && !view.isWorkspaceDefault && !view.isUserDefault && matches(view),
    ),
    workspace: views.filter(
      (view) => (view.isShared || view.isWorkspaceDefault || view.isUserDefault) && matches(view),
    ),
  }
}

function useAutofocusInput() {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeout = window.setTimeout(
      () => ref.current?.focus({ preventScroll: true }),
      MOBILE_VIEWS_DRAWER_INPUT_FOCUS_DELAY_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [])

  return ref
}
