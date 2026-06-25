import { useCallback, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command"
import type {
  DatatableBulkAction,
  DatatableBulkActionContext,
  DatatableBulkActionStep,
  DatatableBulkServerActionRequest,
  DatatableSelectionDescriptor,
} from "../../types/props.types"
import {
  buildBulkActionServerRequest,
  getVisibleBulkActionItems,
  getVisibleBulkActions,
  resolveBulkActionInitialStep,
} from "./bulk-actions-registry"

interface BulkActionDialogProps<TData> {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: DatatableBulkAction<TData>[]
  selection: DatatableSelectionDescriptor
  selectedRowIds: string[]
  selectedRows: TData[]
  selectedCount: number
  onClearSelection: () => void
  serverExecutor?: (request: DatatableBulkServerActionRequest) => void | Promise<void>
}

interface BulkActionDialogContentProps<TData> {
  actions: DatatableBulkAction<TData>[]
  selection: DatatableSelectionDescriptor
  selectedRowIds: string[]
  selectedRows: TData[]
  selectedCount: number
  onClearSelection: () => void
  onClose: () => void
  serverExecutor?: (request: DatatableBulkServerActionRequest) => void | Promise<void>
}

export function BulkActionDialogContent<TData>({
  actions,
  selection,
  selectedRowIds,
  selectedRows,
  selectedCount,
  onClearSelection,
  onClose,
  serverExecutor,
}: BulkActionDialogContentProps<TData>) {
  const [stepStack, setStepStack] = useState<DatatableBulkActionStep<TData>[]>([])

  const context = useMemo<DatatableBulkActionContext<TData>>(
    () => ({
      selection,
      selectedRowIds,
      selectedRows,
      selectedCount,
      clearSelection: onClearSelection,
      closeDialog: onClose,
    }),
    [onClearSelection, onClose, selectedCount, selectedRowIds, selectedRows, selection],
  )

  const activeStep = stepStack.at(-1) ?? null

  const pushStep = useCallback((step: DatatableBulkActionStep<TData>) => {
    setStepStack((current) => [...current, step])
  }, [])

  const replaceStep = useCallback((step: DatatableBulkActionStep<TData>) => {
    setStepStack((current) => [...current.slice(0, -1), step])
  }, [])

  const goBack = useCallback(() => {
    setStepStack((current) => current.slice(0, -1))
  }, [])

  const visibleActions = useMemo(
    () =>
      getVisibleBulkActions({
        actions,
        context,
      }),
    [actions, context],
  )

  const visibleItems = useMemo(() => {
    if (!activeStep || activeStep.kind !== "items") {
      return []
    }

    return getVisibleBulkActionItems({
      items: activeStep.items,
      context,
    })
  }, [activeStep, context])

  const executeServerAction = useCallback(
    async (request: Omit<DatatableBulkServerActionRequest, "selection">) => {
      if (!serverExecutor) {
        return
      }

      await serverExecutor({
        ...request,
        selection: context.selection,
      })
      context.clearSelection()
      context.closeDialog()
    },
    [context, serverExecutor],
  )

  const stepContext = useMemo(
    () => ({
      ...context,
      goBack,
      pushStep,
      replaceStep,
      executeServerAction,
    }),
    [context, executeServerAction, goBack, pushStep, replaceStep],
  )

  const handleActionSelect = useCallback(
    async (action: DatatableBulkAction<TData>) => {
      const initialStep = await resolveBulkActionInitialStep({
        action,
        context,
      })

      if (initialStep) {
        pushStep(initialStep)
        return
      }

      const serverRequest = buildBulkActionServerRequest({
        action,
        context,
      })

      if (serverRequest && serverExecutor) {
        await serverExecutor(serverRequest)
        context.clearSelection()
        context.closeDialog()
        return
      }

      await action.onSelect?.(context)
    },
    [context, pushStep, serverExecutor],
  )

  const handleItemSelect = useCallback(
    async (item: NonNullable<typeof visibleItems>[number]) => {
      if (item.getNextStep) {
        pushStep(await item.getNextStep(context))
        return
      }

      if (item.execution === "server" && item.serverActionId && serverExecutor) {
        await serverExecutor({
          actionId: item.serverActionId,
          selection: context.selection,
          payload: item.getServerPayload?.(context),
        })
        context.clearSelection()
        context.closeDialog()
        return
      }

      await item.onSelect?.(context)
    },
    [context, pushStep, serverExecutor],
  )

  return (
    <Command
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && activeStep) {
          event.preventDefault()
          event.stopPropagation()
          goBack()
        }
      }}
    >
      {!activeStep ? (
        <>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No actions available.</CommandEmpty>
            <CommandGroup heading="Actions">
              {visibleActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`${action.title} ${action.keywords?.join(" ") ?? ""}`}
                  onSelect={() => {
                    void handleActionSelect(action)
                  }}
                >
                  <span>{action.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      ) : null}

      {activeStep?.kind === "items" ? (
        <>
          <CommandInput
            placeholder={activeStep.searchPlaceholder ?? "Type a command or search..."}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {visibleItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle ?? ""} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => {
                    void handleItemSelect(item)
                  }}
                >
                  <div className="flex min-w-0 flex-col">
                    <span>{item.title}</span>
                    {item.subtitle ? (
                      <span className="text-muted-foreground text-xs">{item.subtitle}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      ) : null}

      {activeStep?.kind === "confirm" ? (
        <div className="space-y-4 p-4">
          {activeStep.description ? (
            <p className="text-muted-foreground text-sm">{activeStep.description}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={goBack}>
              {activeStep.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (activeStep.execution === "server" && activeStep.serverActionId) {
                  void executeServerAction({
                    actionId: activeStep.serverActionId,
                    payload: activeStep.buildServerPayload?.(context),
                  })
                  return
                }

                void activeStep.onConfirm(context)
              }}
            >
              {activeStep.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      ) : null}

      {activeStep?.kind === "custom" ? (
        <div className="p-4">{activeStep.render(stepContext)}</div>
      ) : null}
    </Command>
  )
}

export function BulkActionDialog<TData>({
  open,
  onOpenChange,
  actions,
  selection,
  selectedRowIds,
  selectedRows,
  selectedCount,
  onClearSelection,
  serverExecutor,
}: BulkActionDialogProps<TData>) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <BulkActionDialogContent
        actions={actions}
        selection={selection}
        selectedRowIds={selectedRowIds}
        selectedRows={selectedRows}
        selectedCount={selectedCount}
        onClearSelection={onClearSelection}
        onClose={() => onOpenChange(false)}
        serverExecutor={serverExecutor}
      />
    </CommandDialog>
  )
}
