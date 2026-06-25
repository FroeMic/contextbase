"use client"

import { ChevronDownIcon } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/shared/ui/cn"
import { MobileFriendlySearchableDropdown } from "@/shared/ui/mobile-friendly-searchable-dropdown"
import { suppressRowClick } from "@/shared/ui/row-click-suppression"

export type PropertyDropdownOption<TValue extends string = string> = {
  disabled?: boolean
  icon?: ReactNode
  label: string
  searchText?: string
  section?: string
  shortcut?: string
  value: TValue
}

const propertyDropdownIconSlotClassName =
  "flex size-3.5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0"
const compactChipIconSlotClassName =
  "flex size-3.5 shrink-0 items-center justify-center text-muted-foreground [&>*]:size-3.5 [&_svg]:size-3.5 [&_svg]:shrink-0"

export function buildVisiblePropertyDropdownShortcuts<TValue extends string>(
  options: readonly PropertyDropdownOption<TValue>[],
  { disabled }: { disabled: boolean },
) {
  const shortcuts = new Map<TValue, string>()
  if (disabled) return shortcuts

  options.forEach((option, index) => {
    const shortcut = visiblePropertyDropdownShortcutForIndex(index)
    if (shortcut) shortcuts.set(option.value, shortcut)
  })

  return shortcuts
}

export function findPropertyDropdownShortcutOption<TValue extends string>(
  options: readonly PropertyDropdownOption<TValue>[],
  key: string,
  { disabled }: { disabled: boolean },
) {
  if (disabled || !/^[1-9]$/.test(key)) return null

  const option = options[Number(key) - 1]
  if (!option || option.disabled) return null
  return option
}

function visiblePropertyDropdownShortcutForIndex(index: number) {
  if (index < 0 || index > 8) return null
  return String(index + 1)
}

export function PropertyDropdown<TValue extends string>({
  align = "start",
  ariaLabel,
  compact = false,
  compactDisplay = "icon",
  contentClassName,
  disabled = false,
  emptyText = "No options found",
  isLoading = false,
  loadingText = "Loading options…",
  onValueChange,
  options,
  placeholder = "Select...",
  placeholderIcon,
  searchValue,
  selectedIcon,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchShortcut,
  showChevron = false,
  triggerClassName,
  value,
}: {
  align?: "center" | "end" | "start"
  ariaLabel: string
  compact?: boolean
  compactDisplay?: "chip" | "icon"
  contentClassName?: string
  disabled?: boolean
  emptyText?: string
  isLoading?: boolean
  loadingText?: string
  onValueChange: (value: TValue) => void
  options: readonly PropertyDropdownOption<TValue>[]
  placeholder?: string
  placeholderIcon?: ReactNode
  searchValue?: string
  selectedIcon?: ReactNode
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchShortcut?: string
  showChevron?: boolean
  triggerClassName?: string
  value: TValue | ""
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const currentSearch = searchValue ?? search
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = options.find((option) => option.value === value)
  const hasSearchQuery = currentSearch.trim().length > 0
  const setCurrentSearch = useCallback(
    (nextSearch: string) => {
      if (searchValue === undefined) {
        setSearch(nextSearch)
      }
      onSearchChange?.(nextSearch)
    },
    [onSearchChange, searchValue],
  )
  const triggerModeClassName = compact
    ? compactDisplay === "chip"
      ? "inline-flex box-content h-6 max-w-full shrink-0 items-center gap-1.5 rounded-full border-0 bg-background px-2 text-[12px] font-[450] text-foreground whitespace-nowrap shadow-[inset_0_0_0_0.5px_var(--border),0_1px_2px_rgb(0_0_0/0.08)] transition-colors outline-none hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
      : "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-input bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-colors outline-none hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
    : "group flex h-8 w-full min-w-0 items-center gap-2.5 rounded-md px-0 text-left text-[13px] font-normal text-foreground transition-colors outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
  const filteredOptions = useMemo(() => {
    const query = currentSearch.trim().toLowerCase()
    if (!query) return options

    return options.filter((option) =>
      [option.label, option.value, option.searchText].some((entry) =>
        entry?.toLowerCase().includes(query),
      ),
    )
  }, [currentSearch, options])
  const visibleShortcutByValue = useMemo(
    () => buildVisiblePropertyDropdownShortcuts(filteredOptions, { disabled: hasSearchQuery }),
    [filteredOptions, hasSearchQuery],
  )

  useEffect(() => {
    if (!open) {
      if (currentSearch) {
        setCurrentSearch("")
      }
      return
    }
  }, [currentSearch, open, setCurrentSearch])

  useEffect(() => {
    if (!searchShortcut || disabled) return
    const normalizedShortcut = searchShortcut.toLowerCase()

    function handleShortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableShortcutTarget(event.target) ||
        event.key.toLowerCase() !== normalizedShortcut
      ) {
        return
      }

      const matchingTriggers = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-property-dropdown-shortcut]"),
      ).filter((trigger) => trigger.dataset.propertyDropdownShortcut === normalizedShortcut)

      if (matchingTriggers[0] !== triggerRef.current) return

      event.preventDefault()
      setOpen(true)
    }

    document.addEventListener("keydown", handleShortcut)
    return () => document.removeEventListener("keydown", handleShortcut)
  }, [disabled, searchShortcut])

  const selectOption = useCallback(
    (option: PropertyDropdownOption<TValue>) => {
      if (option.disabled) return
      onValueChange(option.value)
      setOpen(false)
    },
    [onValueChange],
  )

  useEffect(() => {
    if (!open || disabled) return

    function handleOptionShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      const option = findPropertyDropdownShortcutOption(filteredOptions, event.key, {
        disabled: hasSearchQuery,
      })
      if (!option) return

      event.preventDefault()
      selectOption(option)
    }

    document.addEventListener("keydown", handleOptionShortcut)
    return () => document.removeEventListener("keydown", handleOptionShortcut)
  }, [disabled, filteredOptions, hasSearchQuery, open, selectOption])

  function handleOptionClick(option: PropertyDropdownOption<TValue>) {
    if (option.disabled) return
    selectOption(option)
  }

  return (
    <MobileFriendlySearchableDropdown
      align={align}
      closeOnSelect
      contentClassName={contentClassName}
      emptyText={isLoading ? loadingText : emptyText}
      filterFn={(option, query) =>
        [option.label, option.value, option.searchText].some((entry) =>
          entry?.toLowerCase().includes(query.trim().toLowerCase()),
        )
      }
      getItemKey={(option) => option.value}
      getItemSection={(option) => option.section}
      isItemDisabled={(option) => Boolean(option.disabled)}
      items={options}
      onInteractOutside={() => suppressRowClick(300)}
      onOpenChange={setOpen}
      onSearchChange={setCurrentSearch}
      onSelect={handleOptionClick}
      open={open}
      renderItem={(option, { surface }) => (
        <>
          <span className={propertyDropdownIconSlotClassName}>{option.icon}</span>
          <span
            className={cn(
              "min-w-0 truncate",
              surface === "desktop" && "grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-2",
            )}
          >
            <span className="truncate">{option.label}</span>
            {surface === "desktop" ? (
              <span className="text-right text-[13px] text-muted-foreground">
                {visibleShortcutByValue.get(option.value)}
              </span>
            ) : null}
          </span>
        </>
      )}
      renderTrigger={({ open: triggerOpen }) => (
        <button
          aria-expanded={triggerOpen}
          aria-label={ariaLabel}
          className={cn(triggerModeClassName, triggerClassName)}
          data-property-dropdown-shortcut={searchShortcut?.toLowerCase()}
          disabled={disabled}
          ref={triggerRef}
          title={selected?.label ?? placeholder}
          type="button"
          onPointerDownCapture={() => suppressRowClick(300)}
          onClickCapture={() => suppressRowClick(300)}
        >
          {compact && compactDisplay === "icon" ? (
            <span className={propertyDropdownIconSlotClassName}>
              {selectedIcon ?? selected?.icon ?? placeholderIcon}
            </span>
          ) : compact && compactDisplay === "chip" ? (
            <>
              <span className={compactChipIconSlotClassName}>
                {selectedIcon ?? selected?.icon ?? placeholderIcon}
              </span>
              <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
                {selected?.label ?? placeholder}
              </span>
            </>
          ) : (
            <>
              <span className={propertyDropdownIconSlotClassName}>
                {selectedIcon ?? selected?.icon ?? placeholderIcon}
              </span>
              <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
                {selected?.label ?? placeholder}
              </span>
              {showChevron ? (
                <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </>
          )}
        </button>
      )}
      searchPlaceholder={searchPlaceholder}
      searchValue={currentSearch}
      selectedKey={String(value)}
      selectionMode="single"
      sideOffset={6}
      title={ariaLabel}
      widthClassName="w-60"
    />
  )
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
}
