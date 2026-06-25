"use client"

import { CheckIcon, XIcon } from "lucide-react"
import {
  cloneElement,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { useIsMobile } from "@/shared/hooks/use-mobile"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/ui/cn"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer"
import { Input } from "@/shared/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { suppressRowClick } from "@/shared/ui/row-click-suppression"

const MOBILE_SEARCH_AUTOFOCUS_DELAY_MS = 320

export type MobileFriendlySearchableDropdownSelectionMode = "multiple" | "single"

export type MobileFriendlySearchableDropdownRenderTriggerOptions = {
  open: boolean
}

export type MobileFriendlySearchableDropdownRenderItemOptions = {
  index: number
  isSelected: boolean
  search: string
  surface: "desktop" | "mobile"
}

export type MobileFriendlySearchableDropdownProps<TItem> = {
  align?: "center" | "end" | "start"
  clearSearchOnClose?: boolean
  closeOnSelect?: boolean
  contentClassName?: string
  desktopListClassName?: string
  emptyText?: string
  filterFn?: (item: TItem, search: string) => boolean
  getItemKey: (item: TItem) => string
  getItemSection?: (item: TItem) => string | undefined
  isItemDisabled?: (item: TItem) => boolean
  isLoading?: boolean
  items: readonly TItem[]
  loadingText?: string
  mobileListClassName?: string
  onInteractOutside?: () => void
  onOpenChange: (open: boolean) => void
  onSearchChange?: (search: string) => void
  onSelect: (item: TItem) => void
  open: boolean
  renderItem: (item: TItem, options: MobileFriendlySearchableDropdownRenderItemOptions) => ReactNode
  renderTrigger: (options: MobileFriendlySearchableDropdownRenderTriggerOptions) => ReactElement
  searchPlaceholder?: string
  searchValue?: string
  selectedKey?: string
  selectedKeys?: readonly string[]
  selectionMode?: MobileFriendlySearchableDropdownSelectionMode
  sideOffset?: number
  title: ReactNode
  widthClassName?: string
}

export function MobileFriendlySearchableDropdown<TItem>({
  align = "start",
  clearSearchOnClose = true,
  closeOnSelect = true,
  contentClassName,
  desktopListClassName,
  emptyText = "No items found",
  filterFn,
  getItemKey,
  getItemSection,
  isItemDisabled,
  isLoading = false,
  items,
  loadingText = "Loading…",
  mobileListClassName,
  onInteractOutside,
  onOpenChange,
  onSearchChange,
  onSelect,
  open,
  renderItem,
  renderTrigger,
  searchPlaceholder = "Search...",
  searchValue,
  selectedKey,
  selectedKeys,
  selectionMode = "single",
  sideOffset = 6,
  title,
  widthClassName = "w-60",
}: MobileFriendlySearchableDropdownProps<TItem>) {
  const isMobile = useIsMobile()
  const [internalSearch, setInternalSearch] = useState("")
  const currentSearch = searchValue ?? internalSearch
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const selectedKeySet = useMemo(
    () => new Set(selectedKeys ?? (selectedKey ? [selectedKey] : [])),
    [selectedKey, selectedKeys],
  )

  const filteredItems = useMemo(() => {
    const query = currentSearch.trim().toLowerCase()
    if (!query) return items

    return items.filter((item) => {
      if (filterFn) return filterFn(item, currentSearch)
      return getItemKey(item).toLowerCase().includes(query)
    })
  }, [currentSearch, filterFn, getItemKey, items])
  const sections = useMemo(
    () => groupSearchableDropdownItems(filteredItems, getItemSection),
    [filteredItems, getItemSection],
  )

  const setSearch = useCallback(
    (nextSearch: string) => {
      if (searchValue === undefined) {
        setInternalSearch(nextSearch)
      }
      onSearchChange?.(nextSearch)
    },
    [onSearchChange, searchValue],
  )

  useEffect(() => {
    if (!open && clearSearchOnClose) {
      setSearch("")
      return
    }

    function focusSearchInput() {
      searchInputRef.current?.focus()
    }

    if (isMobile) {
      const focusTimeout = window.setTimeout(focusSearchInput, MOBILE_SEARCH_AUTOFOCUS_DELAY_MS)
      return () => window.clearTimeout(focusTimeout)
    }

    const frame = window.requestAnimationFrame(focusSearchInput)
    return () => window.cancelAnimationFrame(frame)
  }, [clearSearchOnClose, isMobile, open, setSearch])

  function handleSelect(item: TItem) {
    if (isItemDisabled?.(item)) return
    onSelect(item)
    if (selectionMode === "single" || closeOnSelect) {
      onOpenChange(false)
    }
  }

  const trigger = renderTrigger({ open })

  if (isMobile) {
    return (
      <>
        {cloneDropdownTrigger(trigger, () => onOpenChange(true), open)}
        <Drawer direction="bottom" fixed open={open} onOpenChange={onOpenChange}>
          {open ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-40 bg-background"
            />
          ) : null}
          <DrawerContent
            className="z-50 overflow-hidden bg-popover p-0 before:hidden data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-svh data-[vaul-drawer-direction=bottom]:max-h-svh"
            onClickCapture={() => suppressRowClick(500)}
            onPointerDownCapture={() => suppressRowClick(500)}
            showHandle={false}
            showOverlay={false}
          >
            <DrawerHeader className="grid h-16 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 border-b border-border/70 bg-popover px-3 py-2 text-left">
              <span aria-hidden="true" />
              <div className="min-w-0 text-center">
                <DrawerTitle className="truncate text-base">{title}</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Choose an option from this searchable list.
                </DrawerDescription>
              </div>
              <Button
                aria-label="Close"
                className="justify-self-end"
                onClick={() => onOpenChange(false)}
                size="icon"
                variant="ghost"
              >
                <XIcon className="size-6" />
              </Button>
            </DrawerHeader>
            <SearchableDropdownList
              currentSearch={currentSearch}
              emptyText={emptyText}
              isItemDisabled={isItemDisabled}
              isLoading={isLoading}
              listboxId={listboxId}
              loadingText={loadingText}
              getItemKey={getItemKey}
              onSearchChange={setSearch}
              onSelect={handleSelect}
              renderItem={renderItem}
              searchInputRef={searchInputRef}
              searchPlaceholder={searchPlaceholder}
              sections={sections}
              selectedKeySet={selectedKeySet}
              surface="mobile"
              listClassName={mobileListClassName}
            />
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        className={cn(
          widthClassName,
          "gap-0 overflow-hidden rounded-xl border border-border/70 bg-popover p-0 text-popover-foreground shadow-[0_10px_30px_rgb(0_0_0/0.12)] ring-0",
          contentClassName,
        )}
        onInteractOutside={onInteractOutside}
        sideOffset={sideOffset}
      >
        <SearchableDropdownList
          currentSearch={currentSearch}
          emptyText={emptyText}
          isItemDisabled={isItemDisabled}
          isLoading={isLoading}
          listboxId={listboxId}
          loadingText={loadingText}
          getItemKey={getItemKey}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          renderItem={renderItem}
          searchInputRef={searchInputRef}
          searchPlaceholder={searchPlaceholder}
          sections={sections}
          selectedKeySet={selectedKeySet}
          surface="desktop"
          listClassName={desktopListClassName}
        />
      </PopoverContent>
    </Popover>
  )
}

function SearchableDropdownList<TItem>({
  currentSearch,
  emptyText,
  isItemDisabled,
  isLoading,
  listboxId,
  listClassName,
  loadingText,
  getItemKey,
  onSearchChange,
  onSelect,
  renderItem,
  searchInputRef,
  searchPlaceholder,
  sections,
  selectedKeySet,
  surface,
}: {
  currentSearch: string
  emptyText: string
  isItemDisabled?: (item: TItem) => boolean
  isLoading: boolean
  listboxId: string
  listClassName?: string
  loadingText: string
  getItemKey: (item: TItem) => string
  onSearchChange: (search: string) => void
  onSelect: (item: TItem) => void
  renderItem: (item: TItem, options: MobileFriendlySearchableDropdownRenderItemOptions) => ReactNode
  searchInputRef: React.RefObject<HTMLInputElement | null>
  searchPlaceholder: string
  sections: Array<{ items: readonly TItem[]; section: string }>
  selectedKeySet: Set<string>
  surface: "desktop" | "mobile"
}) {
  const hasItems = sections.some((section) => section.items.length > 0)
  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  let itemIndex = 0

  useEffect(() => {
    if (
      activeIndex === null ||
      !flatItems[activeIndex] ||
      isItemDisabled?.(flatItems[activeIndex])
    ) {
      setActiveIndex(null)
    }
  }, [activeIndex, flatItems, isItemDisabled])

  function moveActiveItem(direction: "ArrowDown" | "ArrowUp") {
    const enabledIndexes = flatItems
      .map((item, index) => (isItemDisabled?.(item) ? null : index))
      .filter((index): index is number => index !== null)
    if (enabledIndexes.length === 0) {
      setActiveIndex(null)
      return
    }

    const currentEnabledIndex = activeIndex === null ? -1 : enabledIndexes.indexOf(activeIndex)
    const nextEnabledIndex =
      direction === "ArrowDown"
        ? currentEnabledIndex === -1
          ? 0
          : (currentEnabledIndex + 1) % enabledIndexes.length
        : currentEnabledIndex === -1
          ? enabledIndexes.length - 1
          : (currentEnabledIndex - 1 + enabledIndexes.length) % enabledIndexes.length

    setActiveIndex(enabledIndexes[nextEnabledIndex] ?? null)
  }

  function selectActiveItem() {
    const activeItem =
      activeIndex === null || isItemDisabled?.(flatItems[activeIndex])
        ? flatItems.find((item) => !isItemDisabled?.(item))
        : flatItems[activeIndex]
    if (activeItem) onSelect(activeItem)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      event.stopPropagation()
      moveActiveItem(event.key)
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      selectActiveItem()
      return
    }

    event.stopPropagation()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "sticky top-0 z-10 bg-popover",
          surface === "mobile" ? "p-4 pb-2" : "border-b border-border/70 px-2 py-1",
        )}
      >
        <Input
          aria-activedescendant={
            activeIndex === null ? undefined : `${listboxId}-option-${activeIndex}`
          }
          aria-label={searchPlaceholder}
          className={cn(
            surface === "mobile"
              ? "h-11 rounded-full border-0 bg-muted/60 px-4 text-base shadow-none focus-visible:ring-0"
              : "h-9 min-w-0 flex-1 rounded-sm border-0 bg-transparent px-0 py-0 text-[13px] shadow-none focus-visible:ring-0",
          )}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          ref={searchInputRef}
          value={currentSearch}
        />
      </div>
      <div
        className={cn(
          surface === "mobile"
            ? "min-h-0 flex-1 overflow-y-auto px-4 py-2"
            : "max-h-72 overflow-y-auto py-2",
          listClassName,
        )}
        id={listboxId}
        role="listbox"
      >
        {!hasItems ? (
          <div
            className={cn(
              "text-center text-muted-foreground",
              surface === "mobile" ? "px-3 py-8 text-base" : "px-3 py-5 text-[13px]",
            )}
          >
            {isLoading ? loadingText : emptyText}
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.section || "default"}>
              {section.section ? (
                <div
                  className={cn(
                    "text-muted-foreground",
                    surface === "mobile" ? "px-1 pt-4 pb-2 text-sm" : "px-3 pt-2 pb-1 text-[12px]",
                  )}
                >
                  {section.section}
                </div>
              ) : null}
              {section.items.map((item) => {
                const key = getItemKey(item)
                const isSelected = selectedKeySet.has(key)
                const index = itemIndex++
                const isActive = activeIndex === index

                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(
                      "grid w-full grid-cols-[1.5rem_minmax(0,1fr)_1.75rem] items-center gap-2 rounded-md text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 disabled:opacity-50",
                      surface === "mobile"
                        ? "min-h-12 px-2 text-base"
                        : "mx-1 min-h-8 w-[calc(100%-0.5rem)] px-2.5 text-[13px]",
                      isActive && "bg-muted/50",
                    )}
                    data-active={isActive ? "true" : undefined}
                    disabled={isItemDisabled?.(item)}
                    id={`${listboxId}-option-${index}`}
                    key={key}
                    onClick={() => onSelect(item)}
                    role="option"
                    type="button"
                  >
                    {renderItem(item, { index, isSelected, search: currentSearch, surface })}
                    <CheckIcon
                      className={cn(
                        "size-4 justify-self-center text-muted-foreground opacity-0",
                        isSelected && "opacity-100",
                      )}
                    />
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function groupSearchableDropdownItems<TItem>(
  items: readonly TItem[],
  getItemSection: ((item: TItem) => string | undefined) | undefined,
) {
  const sections: Array<{ items: TItem[]; section: string }> = []

  for (const item of items) {
    const section = getItemSection?.(item) ?? ""
    const current = sections.at(-1)
    if (current?.section === section) {
      current.items.push(item)
    } else {
      sections.push({ items: [item], section })
    }
  }

  return sections
}

function cloneDropdownTrigger(trigger: ReactElement, onClick: () => void, open: boolean) {
  if (!isValidElement<{ "aria-expanded"?: boolean; onClick?: React.MouseEventHandler }>(trigger)) {
    return trigger
  }

  return cloneElement(trigger, {
    "aria-expanded": open,
    onClick: (event: React.MouseEvent) => {
      trigger.props.onClick?.(event)
      if (!event.defaultPrevented) {
        onClick()
      }
    },
  })
}
