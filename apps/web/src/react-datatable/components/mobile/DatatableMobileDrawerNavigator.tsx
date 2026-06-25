"use client"

import { Check, ChevronLeft, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNestedRoot,
  DrawerTitle,
} from "@/shared/ui/drawer"
import { suppressRowClick } from "@/shared/ui/row-click-suppression"
import { Button } from "../ui/button"
import {
  createDatatableMobileDrawerStack,
  type DatatableMobileDrawerHeaderAction,
  type DatatableMobileDrawerPageDefinition,
  type DatatableMobileDrawerPageRenderContext,
  type DatatableMobileDrawerStackEntry,
  popDatatableMobileDrawerStack,
  pushDatatableMobileDrawerStack,
  replaceDatatableMobileDrawerStack,
} from "./datatable-mobile-drawer-navigation"

export type DatatableMobileDrawerNavigatorProps<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
> = {
  initialPage: TPageId
  initialParams: TParamsByPage[TPageId]
  onOpenChange: (open: boolean) => void
  open: boolean
  pages: Record<TPageId, DatatableMobileDrawerPageDefinition<TPageId, TParamsByPage>>
}

export function DatatableMobileDrawerNavigator<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>({
  initialPage,
  initialParams,
  onOpenChange,
  open,
  pages,
}: DatatableMobileDrawerNavigatorProps<TPageId, TParamsByPage>) {
  const [stack, setStack] = useState(() =>
    createDatatableMobileDrawerStack<TPageId, TParamsByPage>(initialPage, initialParams),
  )

  const reset = useCallback(() => {
    setStack(createDatatableMobileDrawerStack<TPageId, TParamsByPage>(initialPage, initialParams))
  }, [initialPage, initialParams])

  const close = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const pop = useCallback(() => {
    setStack((currentStack) => popDatatableMobileDrawerStack(currentStack))
  }, [])

  const closeToDepth = useCallback((depth: number) => {
    setStack((currentStack) => {
      if (currentStack.length <= depth) return currentStack
      return currentStack.slice(0, Math.max(1, depth))
    })
  }, [])

  const push = useCallback(
    <TNextPageId extends TPageId>(pageId: TNextPageId, params: TParamsByPage[TNextPageId]) => {
      setStack((currentStack) => pushDatatableMobileDrawerStack(currentStack, pageId, params))
    },
    [],
  )

  const replace = useCallback(
    <TNextPageId extends TPageId>(pageId: TNextPageId, params: TParamsByPage[TNextPageId]) => {
      setStack((currentStack) => replaceDatatableMobileDrawerStack(currentStack, pageId, params))
    },
    [],
  )

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const rootEntry = stack[0]

  if (!rootEntry) return null

  return (
    <Drawer direction="bottom" fixed open={open} onOpenChange={onOpenChange}>
      <DatatableMobileDrawerSheet
        closeToDepth={closeToDepth}
        close={close}
        depth={1}
        entry={rootEntry}
        nestedEntries={stack.slice(1)}
        pages={pages}
        pop={pop}
        push={push}
        replace={replace}
        reset={reset}
      />
    </Drawer>
  )
}

function DatatableMobileDrawerSheet<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>({
  closeToDepth,
  close,
  depth,
  entry,
  nestedEntries,
  pages,
  pop,
  push,
  replace,
  reset,
}: {
  closeToDepth: (depth: number) => void
  close: () => void
  depth: number
  entry: DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>
  nestedEntries: DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[]
  pages: Record<TPageId, DatatableMobileDrawerPageDefinition<TPageId, TParamsByPage>>
  pop: () => void
  push: DatatableMobileDrawerPageRenderContext<TPageId, TParamsByPage>["push"]
  replace: DatatableMobileDrawerPageRenderContext<TPageId, TParamsByPage>["replace"]
  reset: () => void
}) {
  const page = pages[entry.pageId]
  const canGoBack = depth > 1
  const [registeredHeaderAction, setRegisteredHeaderAction] = useState<{
    entryKey: string
    action: DatatableMobileDrawerHeaderAction
  } | null>(null)
  const setHeaderAction = useCallback(
    (action: DatatableMobileDrawerHeaderAction | null) => {
      setRegisteredHeaderAction(action ? { action, entryKey: entry.key } : null)
    },
    [entry.key],
  )
  const context = useMemo<DatatableMobileDrawerPageRenderContext<TPageId, TParamsByPage>>(
    () => ({
      close,
      currentPageId: entry.pageId,
      depth,
      pop,
      push,
      replace,
      reset,
      setHeaderAction,
    }),
    [close, depth, entry.pageId, pop, push, replace, reset, setHeaderAction],
  )
  const pageTitle = page.title(entry.params)
  const pageDescription = page.description?.(entry.params) ?? "Configure datatable options."
  const closeIcon = page.closeIcon?.(entry.params) ?? "close"
  const headerAction =
    registeredHeaderAction?.entryKey === entry.key ? registeredHeaderAction.action : null
  const effectiveCloseIcon = headerAction?.icon ?? closeIcon
  const nestedEntry = nestedEntries[0]

  return (
    <DrawerContent
      className="overflow-hidden bg-popover p-0 before:hidden data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-svh data-[vaul-drawer-direction=bottom]:max-h-svh"
      onClickCapture={() => suppressRowClick(500)}
      onPointerDownCapture={() => suppressRowClick(500)}
      showHandle={false}
      showOverlay={false}
    >
      <DrawerHeader className="grid h-16 max-w-full grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 border-b border-border/70 bg-popover px-3 py-2 text-left">
        {canGoBack ? (
          <Button
            aria-label="Back"
            className="justify-self-start"
            onClick={pop}
            size="icon"
            variant="ghost"
          >
            <ChevronLeft className="size-6" />
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="min-w-0 text-center">
          <DrawerTitle className="truncate text-base">{pageTitle}</DrawerTitle>
          <DrawerDescription className="sr-only">{pageDescription}</DrawerDescription>
        </div>
        <Button
          aria-label={headerAction?.label ?? (effectiveCloseIcon === "check" ? "Done" : "Close")}
          className="justify-self-end"
          disabled={headerAction?.disabled}
          onClick={headerAction?.onClick ?? close}
          size="icon"
          variant="ghost"
        >
          {effectiveCloseIcon === "check" ? <Check className="size-6" /> : <X className="size-6" />}
        </Button>
      </DrawerHeader>
      <div className="relative flex min-h-0 flex-1 overflow-hidden" key={entry.key}>
        <div className="min-h-0 w-full shrink-0 overflow-y-auto">
          {page.render(context, entry.params)}
        </div>
      </div>
      {nestedEntry ? (
        <DrawerNestedRoot
          direction="bottom"
          fixed
          key={nestedEntry.key}
          onOpenChange={(isOpen) => {
            if (!isOpen) closeToDepth(depth)
          }}
          open
        >
          <DatatableMobileDrawerSheet
            closeToDepth={closeToDepth}
            close={close}
            depth={depth + 1}
            entry={nestedEntry}
            nestedEntries={nestedEntries.slice(1)}
            pages={pages}
            pop={pop}
            push={push}
            replace={replace}
            reset={reset}
          />
        </DrawerNestedRoot>
      ) : null}
    </DrawerContent>
  )
}
