"use client"

import type { Table } from "@tanstack/react-table"
import { useState } from "react"
import { useIsMobile } from "@/shared/hooks/use-mobile"
import { DisplayOptionsPopover } from "../../features/display-options/DisplayOptionsPopover"
import {
  DISPLAY_DRAWER_INITIAL_PAGE,
  DISPLAY_DRAWER_INITIAL_PARAMS,
  type DisplayDrawerPageId,
  type DisplayDrawerPageParams,
  useMobileDisplayDrawerPages,
} from "../../features/display-options/MobileDisplayDrawerContent"
import type { DatatableProps } from "../../types/props.types"
import { DatatableMobileDrawerNavigator } from "../mobile/DatatableMobileDrawerNavigator"
import { Button } from "../ui/button"
import { SlidersHorizontalIcon } from "../ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

/**
 * Display Options Button
 * Opens a popover with display configuration options
 */

interface DisplayOptionsButtonProps<TData> {
  table: Table<TData>
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptionsConfig?: DatatableProps<TData>["displayOptions"]
}

function isNestedPopoverInteraction(event: Event) {
  const path = event.composedPath()

  return path.some((node) => {
    return node instanceof HTMLElement && node.closest("[data-rdt-nested-popover-content]")
  })
}

export function DisplayOptionsButton<TData>({
  table,
  columnVisibilityUI,
  displayOptionsConfig,
}: DisplayOptionsButtonProps<TData>) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const mobilePages = useMobileDisplayDrawerPages({
    columnVisibilityUI,
    displayOptionsConfig,
    table,
  })

  if (isMobile) {
    return (
      <>
        <Button
          aria-expanded={open}
          className="flex h-9 items-center gap-1 rounded-full px-3.5! text-sm"
          onClick={() => setOpen(true)}
          size="xs"
          variant="outline"
        >
          <SlidersHorizontalIcon className="size-3" />
          Display
        </Button>
        <DatatableMobileDrawerNavigator<DisplayDrawerPageId, DisplayDrawerPageParams>
          initialPage={DISPLAY_DRAWER_INITIAL_PAGE}
          initialParams={DISPLAY_DRAWER_INITIAL_PARAMS}
          onOpenChange={setOpen}
          open={open}
          pages={mobilePages}
        />
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" className="flex items-center gap-1 rounded-full px-2!">
          <SlidersHorizontalIcon className="size-3" />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[90] w-[min(420px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] p-0"
        align="end"
        onInteractOutside={(event) => {
          if (isNestedPopoverInteraction(event.detail.originalEvent)) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isNestedPopoverInteraction(event.detail.originalEvent)) {
            event.preventDefault()
          }
        }}
      >
        <DisplayOptionsPopover
          table={table}
          columnVisibilityUI={columnVisibilityUI}
          displayOptionsConfig={displayOptionsConfig}
        />
      </PopoverContent>
    </Popover>
  )
}
