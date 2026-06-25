"use client"

import type { Table } from "@tanstack/react-table"
import { useEffect, useMemo, useRef } from "react"
import type { DatatableMobileDrawerPageDefinition } from "../../components/mobile/datatable-mobile-drawer-navigation"
import {
  DatatableMobileSelectorProvider,
  type DatatableMobileSelectorRequest,
} from "../../components/mobile/datatable-mobile-selector-context"
import { Input } from "../../components/ui/input"
import { useDropdownKeyboardNav } from "../../shared/hooks/use-dropdown-keyboard-nav"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import { cn } from "../../shared/utils/cn"
import type { DatatableProps } from "../../types/props.types"
import { DisplayOptionsPopover } from "./DisplayOptionsPopover"

export type DisplayDrawerPageId = "root" | "selector"

export type DisplayDrawerPageParams = {
  root: Record<string, never>
  selector: { request: DatatableMobileSelectorRequest }
}

export const DISPLAY_DRAWER_INITIAL_PAGE = "root" satisfies DisplayDrawerPageId
export const DISPLAY_DRAWER_INITIAL_PARAMS = {} satisfies DisplayDrawerPageParams["root"]

export function useMobileDisplayDrawerPages<TData>({
  columnVisibilityUI,
  displayOptionsConfig,
  table,
}: {
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptionsConfig?: DatatableProps<TData>["displayOptions"]
  table: Table<TData>
}) {
  return useMemo(
    () =>
      ({
        root: {
          description: () => "Configure table display options.",
          id: "root",
          render: ({ push }) => (
            <MobileDisplayRootPage
              columnVisibilityUI={columnVisibilityUI}
              displayOptionsConfig={displayOptionsConfig}
              openSelector={(request) => push("selector", { request })}
              table={table}
            />
          ),
          title: () => "Display",
        },
        selector: {
          description: ({ request }) => `${request.searchPlaceholder}`,
          id: "selector",
          render: ({ pop }, { request }) => (
            <MobileDisplaySelectorPage onBack={() => pop()} request={request} />
          ),
          title: ({ request }) => request.title,
        },
      }) satisfies Record<
        DisplayDrawerPageId,
        DatatableMobileDrawerPageDefinition<DisplayDrawerPageId, DisplayDrawerPageParams>
      >,
    [columnVisibilityUI, displayOptionsConfig, table],
  )
}

function MobileDisplayRootPage<TData>({
  columnVisibilityUI,
  displayOptionsConfig,
  openSelector,
  table,
}: {
  columnVisibilityUI?: DatatableProps<TData>["columnVisibilityUI"]
  displayOptionsConfig?: DatatableProps<TData>["displayOptions"]
  openSelector: (request: DatatableMobileSelectorRequest) => void
  table: Table<TData>
}) {
  return (
    <DatatableMobileSelectorProvider openSelector={openSelector}>
      <div className="min-h-0 overflow-y-auto">
        <DisplayOptionsPopover
          columnVisibilityUI={columnVisibilityUI}
          displayOptionsConfig={displayOptionsConfig}
          table={table}
          variant="mobile"
        />
      </div>
    </DatatableMobileSelectorProvider>
  )
}

function MobileDisplaySelectorPage({
  onBack,
  request,
}: {
  onBack: () => void
  request: DatatableMobileSelectorRequest
}) {
  const selectedButtonRef = useRef<HTMLButtonElement>(null)
  const { filteredItems, handleKeyDown, search, selectedIndex, setSearch } = useDropdownKeyboardNav(
    {
      filterFn: request.filterFn,
      items: request.items,
      onEscape: onBack,
      onSelect: (item) => {
        request.onSelect(item)
        onBack()
      },
    },
  )

  useEffect(() => {
    if (selectedIndex < 0) {
      return
    }

    selectedButtonRef.current?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown} role="menu">
      <div className="sticky top-0 z-10 bg-popover p-2">
        <Input
          aria-label={request.searchPlaceholder}
          className={DATATABLE_MOBILE_SEARCH_INPUT_CLASS}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={request.searchPlaceholder}
          role="combobox"
          value={search}
        />
      </div>
      <div
        aria-label={request.searchPlaceholder}
        className="min-h-0 overflow-y-auto p-2"
        role="listbox"
      >
        {filteredItems.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {request.emptyText}
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  "mx-0 h-11 w-full rounded-md px-3 py-2 text-left text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent text-accent-foreground",
                )}
                key={request.getItemKey(item)}
                onClick={() => {
                  request.onSelect(item)
                  onBack()
                }}
                ref={isSelected ? selectedButtonRef : null}
                role="option"
                type="button"
              >
                {request.renderItem(item, isSelected)}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
