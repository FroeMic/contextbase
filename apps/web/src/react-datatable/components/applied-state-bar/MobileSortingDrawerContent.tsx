import { useEffect, useMemo, useRef } from "react"
import type { DatatableMobileDrawerPageDefinition } from "../mobile/datatable-mobile-drawer-navigation"
import {
  DatatableMobileSelectorProvider,
  type DatatableMobileSelectorRequest,
} from "../mobile/datatable-mobile-selector-context"
import { Input } from "../ui/input"
import { useDropdownKeyboardNav } from "../../shared/hooks/use-dropdown-keyboard-nav"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import { cn } from "../../shared/utils/cn"
import { SortingPopover } from "./SortingPopover"

export type SortingDrawerPageId = "root" | "selector"

export type SortingDrawerPageParams = {
  root: Record<string, never>
  selector: { request: DatatableMobileSelectorRequest }
}

export const SORTING_DRAWER_INITIAL_PAGE = "root" satisfies SortingDrawerPageId
export const SORTING_DRAWER_INITIAL_PARAMS = {} satisfies SortingDrawerPageParams["root"]

export function useMobileSortingDrawerPages() {
  return useMemo(
    () =>
      ({
        root: {
          closeIcon: () => "check",
          description: () => "Configure active sorting.",
          id: "root",
          render: ({ push }) => (
            <DatatableMobileSelectorProvider
              openSelector={(request) => push("selector", { request })}
            >
              <SortingPopover variant="mobile" />
            </DatatableMobileSelectorProvider>
          ),
          title: () => "Sorting",
        },
        selector: {
          description: ({ request }) => `${request.searchPlaceholder}`,
          id: "selector",
          render: ({ pop }, { request }) => (
            <MobileSortingSelectorPage onBack={() => pop()} request={request} />
          ),
          title: ({ request }) => request.title,
        },
      }) satisfies Record<
        SortingDrawerPageId,
        DatatableMobileDrawerPageDefinition<SortingDrawerPageId, SortingDrawerPageParams>
      >,
    [],
  )
}

function MobileSortingSelectorPage({
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
    if (selectedIndex < 0) return
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
