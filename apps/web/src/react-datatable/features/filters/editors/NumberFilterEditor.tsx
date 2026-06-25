import { useCallback, useEffect, useState } from "react"
import { Button } from "../../../components/ui/button"
import { PlusIcon, TrashIcon } from "../../../components/ui/icons"
import { Input } from "../../../components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover"
import { useDropdownKeyboardNav } from "../../../shared/hooks/use-dropdown-keyboard-nav"
import { DATATABLE_INLINE_INPUT_CLASS } from "../../../shared/styles/input-classes"
import { cn } from "../../../shared/utils/cn"
import type { NumberFilterMode, NumberFilterPayload } from "../../../types/filter.types"
import { getNumberFilterModeLabel, NUMBER_FILTER_MODE_OPTIONS } from "../constants"

interface NumberFilterEditorProps {
  columnName: string
  value: NumberFilterPayload | null
  onChange: (payload: NumberFilterPayload | null) => void
  onClose: () => void
  variant?: "default" | "mobile"
}

/**
 * Number filter editor with multi-condition support
 *
 * Features:
 * - Multiple conditions per filter
 * - AND/OR operator toggle
 * - Add/remove/edit conditions
 *
 * Modes:
 * - equals: Exact match (=)
 * - gt: Greater than (>)
 * - gte: Greater than or equal (≥)
 * - lt: Less than (<)
 * - lte: Less than or equal (≤)
 */

interface Condition {
  mode: NumberFilterMode
  value: number
}

export const NumberFilterEditor = ({
  columnName,
  value,
  onChange,
  onClose,
  variant = "default",
}: NumberFilterEditorProps) => {
  const [conditions, setConditions] = useState<Condition[]>(
    value?.conditions.length ? value.conditions : [{ mode: "equals", value: 0 }],
  )
  const [operator, setOperator] = useState<"AND" | "OR">(value?.operator ?? "OR")

  // Check if filter is currently active
  const hasActiveFilter = value !== null

  // Sync local state when props change (e.g., when reopening editor for existing filter)
  useEffect(() => {
    if (value?.conditions.length) {
      setConditions(value.conditions)
      setOperator(value.operator ?? "OR")
    } else {
      setConditions([{ mode: "equals", value: 0 }])
      setOperator("OR")
    }
  }, [value])

  const handleApply = () => {
    // Filter out conditions with invalid values
    const validConditions = conditions.filter((c) => !isNaN(c.value))

    if (validConditions.length === 0) {
      onChange(null)
    } else {
      onChange({
        conditions: validConditions,
        operator,
      })
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const handleRemoveFilter = () => {
    onChange(null)
  }

  const handleAddCondition = () => {
    setConditions([...conditions, { mode: "equals", value: 0 }])
  }

  const handleRemoveCondition = (index: number) => {
    const newConditions = conditions.filter((_, idx) => idx !== index)
    // Keep at least one condition
    if (newConditions.length === 0) {
      setConditions([{ mode: "equals", value: 0 }])
    } else {
      setConditions(newConditions)
    }
  }

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((cond, idx) => (idx === index ? { ...cond, ...updates } : cond)))
  }

  const handleConditionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleApply()
    }
  }

  const toggleOperator = () => {
    setOperator(operator === "AND" ? "OR" : "AND")
  }

  return (
    <div className={cn("space-y-3 p-2.5", variant === "mobile" && "space-y-4 p-4")}>
      {/* Header: Column name + operator toggle (if multiple conditions) */}
      <div
        className={cn(
          "flex items-center justify-between gap-4 pr-8",
          variant === "mobile" && "pr-0",
        )}
      >
        <span className={cn("text-sm font-medium", variant === "mobile" && "text-base")}>
          {columnName}
        </span>
        {conditions.length > 1 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleOperator}
            className={cn("shrink-0", variant === "mobile" && "h-10 px-3 text-sm")}
          >
            Match {operator === "AND" ? "all" : "any"}
          </Button>
        )}
      </div>

      {/* Conditions list */}
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            index={index}
            canRemove={conditions.length > 1}
            onUpdate={handleUpdateCondition}
            onRemove={handleRemoveCondition}
            onKeyDown={handleConditionKeyDown}
            variant={variant}
          />
        ))}
      </div>

      {/* Add condition button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddCondition}
        className={cn("w-full text-xs", variant === "mobile" && "h-11 text-sm")}
      >
        <PlusIcon className="mr-1 h-4 w-4" />
        Add condition
      </Button>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFilter}
            className={cn(
              "text-xs focus-visible:ring-2 focus-visible:ring-ring",
              variant === "mobile" && "h-10 text-sm",
            )}
          >
            Remove Filter
          </Button>
        )}
        <div className={cn("flex gap-2", !hasActiveFilter && "ml-auto")}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className={cn("text-xs", variant === "mobile" && "h-10 text-sm")}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className={cn("text-xs", variant === "mobile" && "h-10 text-sm")}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ConditionRowProps {
  condition: Condition
  index: number
  canRemove: boolean
  onUpdate: (index: number, updates: Partial<Condition>) => void
  onRemove: (index: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  variant?: "default" | "mobile"
}

const ConditionRow = ({
  condition,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onKeyDown,
  variant = "default",
}: ConditionRowProps) => {
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  const {
    search: modeSearch,
    setSearch,
    selectedIndex,
    handleKeyDown: handleModeDropdownKeyDown,
    filteredItems: filteredModeOptions,
  } = useDropdownKeyboardNav({
    items: NUMBER_FILTER_MODE_OPTIONS,
    onSelect: (option) => {
      onUpdate(index, { mode: option.value })
      setModeDropdownOpen(false)
    },
    filterFn: (opt, search) => opt.label.toLowerCase().includes(search.toLowerCase()),
    onEscape: () => setModeDropdownOpen(false),
  })

  // Reset search when dropdown closes
  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      setModeDropdownOpen(open)
      if (!open) {
        setSearch("")
      }
    },
    [setSearch],
  )

  const currentModeLabel = getNumberFilterModeLabel(condition.mode)

  return (
    <div className="flex items-start gap-2">
      {/* Mode dropdown */}
      <div className="flex-shrink-0">
        {variant === "mobile" ? (
          <select
            aria-label="Number filter operator"
            className="h-10 w-28 rounded-md border bg-background px-2 text-base text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onUpdate(index, { mode: event.target.value as NumberFilterMode })}
            value={condition.mode}
          >
            {NUMBER_FILTER_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <Popover open={modeDropdownOpen} onOpenChange={handleDropdownOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 w-[110px] items-center justify-center rounded-md bg-transparent px-2 text-sm transition-colors hover:bg-accent",
                  "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="text-xs text-muted-foreground">{currentModeLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="z-[130] w-48 p-0" align="start">
              <div className="flex flex-col" onKeyDown={handleModeDropdownKeyDown}>
                <div className="border-b p-0.5">
                  <Input
                    value={modeSearch}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className={cn(
                      DATATABLE_INLINE_INPUT_CLASS,
                      "h-8 border-none bg-transparent px-2 py-1 focus-visible:outline-none focus-visible:ring-0",
                    )}
                    autoFocus
                  />
                </div>
                <div className="scrollbar-hidden max-h-64 overflow-y-auto py-1">
                  {filteredModeOptions.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No modes found
                    </div>
                  ) : (
                    filteredModeOptions.map((option, idx) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onUpdate(index, { mode: option.value })
                          setModeDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                          idx === selectedIndex && "bg-accent",
                        )}
                      >
                        {option.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Value input */}
      <div className="flex-1">
        <Input
          type="number"
          value={condition.value}
          onChange={(e) => onUpdate(index, { value: parseFloat(e.target.value) })}
          onKeyDown={onKeyDown}
          placeholder="Enter number..."
          className={cn(
            "h-8 text-base sm:text-xs md:text-xs",
            variant === "mobile" && "h-10 text-base sm:text-base md:text-base",
          )}
          autoFocus={index === 0 && !modeDropdownOpen}
        />
      </div>

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className={cn(
            "hover:bg-accent text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            variant === "mobile" && "h-10 w-10",
          )}
          aria-label="Remove condition"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
