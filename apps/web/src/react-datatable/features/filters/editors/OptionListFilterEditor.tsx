import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CheckIcon } from "../../../components/ui/icons"
import { Input } from "../../../components/ui/input"
import {
  DATATABLE_INLINE_INPUT_CLASS,
  DATATABLE_MOBILE_SEARCH_INPUT_CLASS,
} from "../../../shared/styles/input-classes"
import { cn } from "../../../shared/utils/cn"
import type { FilterOption, FilterOptionValue } from "../../../types/filter.types"

const RADIX_SUBMENU_MOUNT_DELAY = 50

export interface OptionListFilterEditorProps<T extends FilterOptionValue> {
  columnLabel: string
  options: FilterOption<T>[]
  selectedValues: T[]
  onSelectedValuesChange: (values: T[]) => void
  onClear?: () => void
  selectionMode?: "single" | "multiple"
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  loadingText?: string
  renderOption?: (option: FilterOption<T>) => ReactNode
  variant?: "default" | "mobile"
}

function getOptionKey<T extends FilterOptionValue>(value: T): string {
  return String(value)
}

export function OptionListFilterEditor<T extends FilterOptionValue>({
  columnLabel,
  options,
  selectedValues,
  onSelectedValuesChange,
  onClear,
  selectionMode = "multiple",
  searchPlaceholder = "Search options...",
  emptyText = "No options available",
  loading = false,
  loadingText = "Loading options...",
  renderOption,
  variant = "default",
}: OptionListFilterEditorProps<T>) {
  const [selected, setSelected] = useState<T[]>(selectedValues)
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelected((prev) => {
      if (
        prev.length === selectedValues.length &&
        prev.every((entry, index) => entry === selectedValues[index])
      ) {
        return prev
      }
      return selectedValues
    })
  }, [selectedValues])

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, RADIX_SUBMENU_MOUNT_DELAY)
    return () => clearTimeout(timer)
  }, [])

  const filteredOptions = useMemo(() => {
    if (!search) {
      return options
    }

    return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
  }, [options, search])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [filteredOptions])

  const hasActiveFilter = selected.length > 0

  const toggleOption = (optionValue: T) => {
    const hasValue = selected.some((entry) => entry === optionValue)
    const next =
      selectionMode === "single"
        ? hasValue
          ? []
          : [optionValue]
        : hasValue
          ? selected.filter((entry) => entry !== optionValue)
          : [...selected, optionValue]

    setSelected(next)
    onSelectedValuesChange(next)
  }

  const handleClear = () => {
    setSelected([])
    onSelectedValuesChange([])
    onClear?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      return
    }

    e.stopPropagation()

    const maxIndex = hasActiveFilter ? filteredOptions.length : filteredOptions.length - 1

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (filteredOptions.length === 0 && !hasActiveFilter) {
        return
      }

      setSelectedIndex((prev) => {
        const newIndex = prev + 1
        if (newIndex > maxIndex) {
          inputRef.current?.focus()
          return -1
        }
        return newIndex
      })
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (filteredOptions.length === 0 && !hasActiveFilter) {
        return
      }

      setSelectedIndex((prev) => {
        if (prev <= 0) {
          return maxIndex
        }
        return prev - 1
      })
      return
    }

    if (e.key === " ") {
      e.preventDefault()
      if (selectedIndex === 0 && hasActiveFilter) {
        handleClear()
        return
      }

      const optionIndex = hasActiveFilter ? selectedIndex - 1 : selectedIndex
      if (optionIndex >= 0 && optionIndex < filteredOptions.length) {
        toggleOption(filteredOptions[optionIndex].value)
      }
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex === 0 && hasActiveFilter) {
        handleClear()
        return
      }

      const optionIndex = hasActiveFilter ? selectedIndex - 1 : selectedIndex
      if (optionIndex >= 0 && optionIndex < filteredOptions.length) {
        toggleOption(filteredOptions[optionIndex].value)
      }
      return
    }

    if (e.key === "Tab") {
      e.preventDefault()
      const direction = e.shiftKey ? -1 : 1
      setSelectedIndex((prev) => {
        const newIndex = prev + direction
        if (newIndex < -1) {
          return maxIndex
        }
        if (newIndex > maxIndex) {
          inputRef.current?.focus()
          return -1
        }
        return newIndex
      })
    }
  }

  return (
    <div
      className={cn("flex flex-col", variant === "mobile" ? "w-full" : "w-60")}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "bg-popover sticky top-0 z-10",
          variant === "mobile" ? "p-2" : "border-b p-0.5",
        )}
      >
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Search ${columnLabel} options`}
          className={cn(
            variant === "mobile"
              ? DATATABLE_MOBILE_SEARCH_INPUT_CLASS
              : DATATABLE_INLINE_INPUT_CLASS,
            variant === "mobile"
              ? "focus-visible:ring-0 focus-visible:outline-none"
              : "h-8 border-none bg-transparent px-2 py-1 focus-visible:ring-0 focus-visible:outline-none",
          )}
        />
      </div>

      {hasActiveFilter && (
        <div className="px-2 pt-0.5">
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "inline-flex h-6 items-center justify-center rounded-md px-2 text-xs font-normal transition-colors",
              variant === "mobile" && "h-9 px-3 text-sm",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-0",
              selectedIndex === 0 && "bg-accent text-accent-foreground",
            )}
          >
            Remove Filter
          </button>
        </div>
      )}

      <div className="scrollbar-hidden max-h-64 overflow-y-auto py-1">
        {loading ? (
          <div className="text-muted-foreground px-3 py-8 text-center text-xs">{loadingText}</div>
        ) : filteredOptions.length === 0 ? (
          <div className="text-muted-foreground px-3 py-8 text-center text-xs">
            {search ? "No options found" : emptyText}
          </div>
        ) : (
          filteredOptions.map((option, index) => {
            const itemIndex = hasActiveFilter ? index + 1 : index
            const optionKey = getOptionKey(option.value)
            const isSelected = selected.some((entry) => getOptionKey(entry) === optionKey)

            return (
              <button
                key={optionKey}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                className={cn(
                  "relative mx-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center rounded py-1.5 pr-2 pl-8 text-left text-xs transition-colors",
                  variant === "mobile" && "mx-0 h-11 w-full rounded-md py-2 pr-3 pl-10 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  itemIndex === selectedIndex && "bg-accent/50 text-accent-foreground",
                )}
                onClick={() => toggleOption(option.value)}
              >
                <span
                  className={cn(
                    "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                    variant === "mobile" && "left-3 h-4 w-4",
                  )}
                >
                  {isSelected && <CheckIcon className="h-4 w-4" />}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {renderOption ? renderOption(option) : option.label}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
