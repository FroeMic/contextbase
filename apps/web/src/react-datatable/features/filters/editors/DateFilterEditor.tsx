import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DatatableMobileDrawerHeaderAction } from "../../../components/mobile/datatable-mobile-drawer-navigation"
import { Button } from "../../../components/ui/button"
import { Calendar } from "../../../components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../components/ui/dialog"
import { Input } from "../../../components/ui/input"
import {
  DATATABLE_INLINE_INPUT_CLASS,
  DATATABLE_MOBILE_SEARCH_INPUT_CLASS,
} from "../../../shared/styles/input-classes"
import { cn } from "../../../shared/utils/cn"
import { useDatatableStore } from "../../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../../types/column.types"
import type { DateFilterPayload } from "../../../types/filter.types"
import { DATE_FILTER_PRESET_OPTIONS } from "../constants"
import { getRelativeDateRange } from "../date-filter-utils"
import { DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME } from "../filter-dialog-layout"

// Delay for Radix submenu mount
const RADIX_SUBMENU_MOUNT_DELAY = 50

export interface DateFilterEditorProps<TData> {
  column: DatatableColumn<TData>
  value: DateFilterPayload | null
  onChange: (payload: DateFilterPayload | null) => void
  onClose?: () => void
  onCustomDateRequest?: () => void
  variant?: "default" | "mobile"
}

/**
 * Date Filter Editor Component
 *
 * Two-level UI:
 * 1. Preset list with quick options (1 day ago, 3 days ago, etc.)
 * 2. Custom date picker (opens from "Custom date or timeframe..." option)
 *
 * Matches Linear's date filter pattern with searchable presets.
 */
export function DateFilterEditor<TData>({
  column,
  value,
  onChange,
  onClose,
  onCustomDateRequest,
  variant = "default",
}: DateFilterEditorProps<TData>) {
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(-1) // -1 means input is focused
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const removeColumnFilter = useDatatableStore((s) => s.removeColumnFilter)

  // Check if filter is currently active
  const hasActiveFilter = value !== null

  // Keep ref up to date
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Focus the input when component mounts (submenu opens)
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, RADIX_SUBMENU_MOUNT_DELAY)
    return () => clearTimeout(timer)
  }, [])

  // Filter presets based on search query
  // Adjust labels based on current mode (e.g., "1 week ago" vs "1 week ago and today")
  const filteredPresets = useMemo(() => {
    const presetsWithAdjustedLabels = DATE_FILTER_PRESET_OPTIONS.map((opt) => {
      // For "range" mode, append "and today" to preset labels
      if (value?.mode === "range" && opt.value !== "custom") {
        return { ...opt, label: `${opt.label} and today` }
      }
      return opt
    })

    return search
      ? presetsWithAdjustedLabels.filter((opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()),
        )
      : presetsWithAdjustedLabels
  }, [search, value?.mode])
  const mobilePresets = useMemo(() => {
    if (search) {
      return filteredPresets
    }

    const customPreset = filteredPresets.find((opt) => opt.value === "custom")
    const regularPresets = filteredPresets.filter((opt) => opt.value !== "custom")

    return customPreset ? [customPreset, ...regularPresets] : regularPresets
  }, [filteredPresets, search])
  const visiblePresets = variant === "mobile" ? mobilePresets : filteredPresets

  const handleRemoveFilter = () => {
    removeColumnFilter(column.id)
    onClose?.()
  }

  // Handle preset selection
  const handlePresetSelect = (presetValue: string) => {
    if (presetValue === "custom") {
      if (onCustomDateRequest) {
        onCustomDateRequest?.()
      } else {
        setCustomPickerOpen(true)
      }
    } else {
      // Calculate the date from the preset
      const { start } = getRelativeDateRange(presetValue)
      const now = new Date()

      // If current mode is "range", apply preset as range (start to now)
      if (value?.mode === "range") {
        onChange({ mode: "range", value: start.toISOString(), value2: now.toISOString() })
      } else if (value?.mode === "before") {
        onChange({ mode: "before", value: start.toISOString() })
      } else if (value?.mode === "custom") {
        onChange({ mode: "custom", value: start.toISOString() })
      } else {
        // Default to "after" mode for presets (most common use case)
        onChange({ mode: "after", value: start.toISOString() })
      }

      if (variant === "mobile") {
        onClose?.()
      }
    }
  }

  // Handle keyboard navigation in preset list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape or ArrowLeft closes submenu - let Radix handle it
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      return
    }

    // Stop propagation for all other keys
    e.stopPropagation()

    // Navigation indices (with remove button at top when filter is active):
    // -1: input
    // 0: remove button (when hasActiveFilter), or first preset (when !hasActiveFilter)
    // 1+: presets (shifted by 1 when hasActiveFilter)
    const maxIndex = hasActiveFilter ? visiblePresets.length : visiblePresets.length - 1

    // ArrowDown navigation
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (visiblePresets.length === 0 && !hasActiveFilter) {
        return
      }

      setSelectedIndex((prev) => {
        const newIndex = prev + 1
        if (newIndex > maxIndex) {
          // Wrap to input
          inputRef.current?.focus()
          return -1
        }
        return newIndex
      })
      return
    }

    // ArrowUp navigation
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (visiblePresets.length === 0 && !hasActiveFilter) {
        return
      }

      setSelectedIndex((prev) => {
        if (prev <= 0) {
          // Wrap to last preset
          return maxIndex
        }
        return prev - 1
      })
      return
    }

    // Enter selects the highlighted preset
    if (e.key === "Enter") {
      e.preventDefault()
      // Remove button selected (now at index 0 when filter is active)
      if (selectedIndex === 0 && hasActiveFilter) {
        handleRemoveFilter()
        return
      }
      // Preset selected (adjust index if remove button is present)
      const presetIndex = hasActiveFilter ? selectedIndex - 1 : selectedIndex
      if (presetIndex >= 0 && presetIndex < visiblePresets.length) {
        handlePresetSelect(visiblePresets[presetIndex].value)
        return
      }
    }

    // Tab navigation
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
    <>
      <fieldset
        className={cn(
          "m-0 flex w-60 min-w-0 flex-col overflow-hidden border-0 p-0",
          variant === "mobile" && "w-full",
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Search input - sticky at top */}
        <div
          className={cn(
            "bg-popover sticky top-0 z-10",
            variant === "mobile" ? "p-2" : "border-b p-0.5",
          )}
        >
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(-1)
            }}
            placeholder="Filter..."
            aria-label={`Filter ${column.header} presets`}
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

        {/* Remove Filter button - positioned right after input when filter is active */}
        {hasActiveFilter && (
          <div className="mx-1 pt-0.5">
            <button
              type="button"
              onClick={handleRemoveFilter}
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

        {/* Preset options list - scrollable */}
        <div ref={containerRef} className="scrollbar-hidden max-h-64 overflow-y-auto py-1">
          {visiblePresets.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center text-xs">
              No presets found
            </div>
          ) : (
            visiblePresets.map((preset, index) => {
              // Adjust selected index to account for remove button being at position 0
              const itemIndex = hasActiveFilter ? index + 1 : index
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetSelect(preset.value)}
                  className={cn(
                    "hover:bg-accent mx-1 w-[calc(100%-0.5rem)] rounded px-2 py-1.5 text-left text-xs transition-colors",
                    variant === "mobile" && "mx-0 h-11 w-full rounded-md px-3 py-2 text-sm",
                    itemIndex === selectedIndex && "bg-accent/50 text-accent-foreground",
                  )}
                >
                  {preset.label}
                </button>
              )
            })
          )}
        </div>
      </fieldset>

      {onCustomDateRequest ? null : (
        <CustomDatePickerDialog
          open={customPickerOpen}
          onOpenChange={setCustomPickerOpen}
          value={value}
          onChange={onChange}
          columnHeader={column.header}
          onClose={onClose}
        />
      )}
    </>
  )
}

/**
 * Custom Date Picker Dialog
 *
 * Modal dialog that opens when user selects "Custom date or timeframe..."
 * Supports different modes: specific date, date range, before, after
 */
export interface CustomDatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: DateFilterPayload | null
  onChange: (payload: DateFilterPayload | null) => void
  columnHeader: string
  onClose?: () => void
}

export function CustomDatePickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  columnHeader,
  onClose,
}: CustomDatePickerDialogProps) {
  // Stop keyboard events from bubbling out of modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME} w-[600px] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]`}
        onKeyDown={handleKeyDown}
      >
        {/* Screen-reader only accessibility labels */}
        <DialogTitle className="sr-only">Filter {columnHeader}</DialogTitle>
        <DialogDescription className="sr-only">
          Select a date filter mode and choose dates
        </DialogDescription>

        <CustomDatePickerContent
          columnHeader={columnHeader}
          onCancel={() => onOpenChange(false)}
          onChange={onChange}
          onClose={() => {
            onOpenChange(false)
            onClose?.()
          }}
          value={value}
        />
      </DialogContent>
    </Dialog>
  )
}

export interface CustomDatePickerContentProps {
  value: DateFilterPayload | null
  onChange: (payload: DateFilterPayload | null) => void
  columnHeader: string
  onCancel?: () => void
  onClose?: () => void
  onMobileHeaderActionChange?: (action: DatatableMobileDrawerHeaderAction | null) => void
  variant?: "default" | "mobile"
}

export function CustomDatePickerContent({
  value,
  onChange,
  columnHeader,
  onCancel,
  onClose,
  onMobileHeaderActionChange,
  variant = "default",
}: CustomDatePickerContentProps) {
  // Initialize mode - default to "before" if not set or if mode is "preset"
  const initialMode: "custom" | "range" | "before" | "after" =
    value?.mode === "custom" ||
    value?.mode === "range" ||
    value?.mode === "before" ||
    value?.mode === "after"
      ? value.mode
      : "before"
  const [mode, setMode] = useState<"custom" | "range" | "before" | "after">(initialMode)
  const [date1, setDate1] = useState<Date | undefined>(
    value?.value ? new Date(value.value) : undefined,
  )
  const [date2, setDate2] = useState<Date | undefined>(
    value?.value2 ? new Date(value.value2) : undefined,
  )

  // Check if filter is currently active
  const hasActiveFilter = value !== null
  const canApply = Boolean(date1 && (mode !== "range" || date2))

  // Handle apply
  const handleApply = useCallback(() => {
    if (!canApply) return

    if (mode === "custom" && date1) {
      onChange({ mode: "custom", value: date1.toISOString() })
      onClose?.()
    } else if (mode === "range" && date1 && date2) {
      onChange({ mode: "range", value: date1.toISOString(), value2: date2.toISOString() })
      onClose?.()
    } else if (mode === "before" && date1) {
      onChange({ mode: "before", value: date1.toISOString() })
      onClose?.()
    } else if (mode === "after" && date1) {
      onChange({ mode: "after", value: date1.toISOString() })
      onClose?.()
    }
  }, [canApply, date1, date2, mode, onChange, onClose])

  useEffect(() => {
    if (variant !== "mobile" || !onMobileHeaderActionChange) return

    onMobileHeaderActionChange({
      disabled: !canApply,
      icon: "check",
      label: "Apply filter",
      onClick: handleApply,
    })

    return () => onMobileHeaderActionChange(null)
  }, [canApply, handleApply, onMobileHeaderActionChange, variant])

  // Handle cancel
  const handleCancel = () => {
    onCancel?.()
  }

  // Handle remove filter
  const handleRemoveFilter = () => {
    onChange(null)
    onClose?.()
  }

  return (
    <div className={cn("space-y-3 p-2.5", variant === "mobile" && "flex min-h-0 flex-col p-2")}>
      {/* Header: Column name */}
      <div className="flex items-center justify-between gap-4 pr-8">
        <span className="text-sm font-medium">{columnHeader}</span>
      </div>

      {/* Mode selector - button group */}
      <fieldset
        className={cn(
          "m-0 inline-flex min-w-0 rounded-md border-0 p-0",
          variant === "mobile" && "w-full",
        )}
      >
        <Button
          size="xs"
          variant={mode === "before" ? "secondary" : "outline"}
          onClick={() => setMode("before")}
          className={cn(
            "rounded-r-none border font-normal focus-visible:ring-0 focus-visible:ring-offset-0",
            variant === "mobile" && "h-9 flex-1 text-sm",
          )}
        >
          Before
        </Button>
        <Button
          size="xs"
          variant={mode === "after" ? "secondary" : "outline"}
          onClick={() => setMode("after")}
          className={cn(
            "rounded-none border border-l-0 font-normal focus-visible:ring-0 focus-visible:ring-offset-0",
            variant === "mobile" && "h-9 flex-1 text-sm",
          )}
        >
          After
        </Button>
        <Button
          size="xs"
          variant={mode === "range" ? "secondary" : "outline"}
          onClick={() => setMode("range")}
          className={cn(
            "rounded-none border border-l-0 font-normal focus-visible:ring-0 focus-visible:ring-offset-0",
            variant === "mobile" && "h-9 flex-1 text-sm",
          )}
        >
          Between
        </Button>
        <Button
          size="xs"
          variant={mode === "custom" ? "secondary" : "outline"}
          onClick={() => setMode("custom")}
          className={cn(
            "rounded-l-none border border-l-0 font-normal focus-visible:ring-0 focus-visible:ring-offset-0",
            variant === "mobile" && "h-9 flex-1 text-sm",
          )}
        >
          On
        </Button>
      </fieldset>

      {/* Calendar(s) - fixed dimensions to prevent layout shift */}
      <div className={cn(variant === "mobile" && "min-h-0 overflow-y-auto")}>
        {mode === "range" ? (
          <div className={cn("flex gap-3", variant === "mobile" && "flex-col")}>
            <div className="flex-1">
              <div className="text-muted-foreground mb-2 text-xs">From</div>
              <Calendar
                mode="single"
                selected={date1}
                onSelect={setDate1}
                captionLayout="dropdown"
                startMonth={new Date(1900, 0)}
                endMonth={new Date(2100, 11)}
                dayFontSize="text-xs"
                style={
                  {
                    "--cell-size": variant === "mobile" ? "2.75rem" : "2.5rem",
                    width: variant === "mobile" ? "min(100%, 21rem)" : "240px",
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground mb-2 text-xs">To</div>
              <Calendar
                mode="single"
                selected={date2}
                onSelect={setDate2}
                captionLayout="dropdown"
                startMonth={new Date(1900, 0)}
                endMonth={new Date(2100, 11)}
                dayFontSize="text-xs"
                style={
                  {
                    "--cell-size": variant === "mobile" ? "2.75rem" : "2.5rem",
                    width: variant === "mobile" ? "min(100%, 21rem)" : "240px",
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="text-muted-foreground mb-2 text-xs">From</div>
            <Calendar
              mode="single"
              selected={date1}
              onSelect={setDate1}
              captionLayout="dropdown"
              startMonth={new Date(1900, 0)}
              endMonth={new Date(2100, 11)}
              dayFontSize="text-xs!"
              style={
                {
                  "--cell-size": variant === "mobile" ? "2.75rem" : "2.5rem",
                  width: variant === "mobile" ? "min(100%, 21rem)" : "240px",
                } as React.CSSProperties
              }
              buttonVariant="ghost"
            />
          </>
        )}
      </div>

      {hasActiveFilter && variant === "mobile" ? (
        <div className="sticky bottom-0 border-t bg-popover py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFilter}
            className="h-10 rounded-full px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            Remove Filter
          </Button>
        </div>
      ) : null}

      {/* Actions */}
      {variant !== "mobile" ? (
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFilter}
              className="text-xs focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove Filter
            </Button>
          )}
          <div className={cn("flex gap-2", !hasActiveFilter && "ml-auto")}>
            <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} disabled={!canApply} className="text-xs">
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
