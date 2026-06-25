import { useCallback, useEffect, useMemo, useState } from "react"
import type { DatatableMobileDrawerHeaderAction } from "../../../components/mobile/datatable-mobile-drawer-navigation"
import { Button } from "../../../components/ui/button"
import { PlusIcon, TrashIcon } from "../../../components/ui/icons"
import { Input } from "../../../components/ui/input"
import { SearchableDropdown } from "../../../components/ui/searchable-dropdown"
import { cn } from "../../../shared/utils/cn"
import type { TextFilterPayload } from "../../../types/filter.types"
import { getTextFilterModeLabel, TEXT_FILTER_MODE_OPTIONS, type TextFilterMode } from "../constants"

interface TextFilterEditorProps {
  columnName: string
  value: TextFilterPayload | null
  onChange: (payload: TextFilterPayload | null) => void
  onClose: () => void
  onMobileHeaderActionChange?: (action: DatatableMobileDrawerHeaderAction | null) => void
  variant?: "default" | "mobile"
}

/**
 * Text filter editor with multi-condition support
 *
 * Features:
 * - Multiple conditions per filter
 * - AND/OR operator toggle
 * - Add/remove/edit conditions
 *
 * Modes:
 * - contains: Case-insensitive substring match
 * - equals: Exact match (case-insensitive)
 * - startsWith: Starts with search value
 * - endsWith: Ends with search value
 * - notContains: Does not contain search value
 */

interface Condition {
  mode: TextFilterMode
  value: string
}

export const TextFilterEditor = ({
  columnName,
  value,
  onChange,
  onClose,
  onMobileHeaderActionChange,
  variant = "default",
}: TextFilterEditorProps) => {
  const [conditions, setConditions] = useState<Condition[]>(
    value?.conditions.length ? value.conditions : [{ mode: "contains", value: "" }],
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
      setConditions([{ mode: "contains", value: "" }])
      setOperator("OR")
    }
  }, [value])

  const validConditions = useMemo(
    () => conditions.filter((condition) => condition.value.trim()),
    [conditions],
  )
  const canApply = validConditions.length > 0

  const handleApply = useCallback(() => {
    if (variant === "mobile" && !canApply) return

    // Filter out empty conditions
    if (!canApply) {
      onChange(null)
    } else {
      onChange({
        conditions: validConditions,
        operator,
      })
    }
  }, [canApply, onChange, operator, validConditions, variant])

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

  const handleCancel = () => {
    onClose()
  }

  const handleRemoveFilter = () => {
    onChange(null)
  }

  const handleAddCondition = () => {
    setConditions([...conditions, { mode: "contains", value: "" }])
  }

  const handleRemoveCondition = (index: number) => {
    const newConditions = conditions.filter((_, idx) => idx !== index)
    // Keep at least one condition
    if (newConditions.length === 0) {
      setConditions([{ mode: "contains", value: "" }])
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

  const shouldShowOperatorToggle = conditions.length > 1

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
        {(variant === "mobile" || shouldShowOperatorToggle) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleOperator}
            disabled={!shouldShowOperatorToggle}
            aria-hidden={!shouldShowOperatorToggle}
            tabIndex={shouldShowOperatorToggle ? undefined : -1}
            className={cn(
              "shrink-0",
              variant === "mobile" && "h-10 px-3 text-sm",
              !shouldShowOperatorToggle && "invisible pointer-events-none",
            )}
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

      {hasActiveFilter && variant === "mobile" ? (
        <div className="border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFilter}
            className="h-10 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            Remove Filter
          </Button>
        </div>
      ) : null}

      {/* Action buttons */}
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
            <Button size="sm" onClick={handleApply} className="text-xs">
              Apply
            </Button>
          </div>
        </div>
      ) : null}
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

  const handleModeSelect = useCallback(
    (option: (typeof TEXT_FILTER_MODE_OPTIONS)[number]) => {
      onUpdate(index, { mode: option.value })
    },
    [index, onUpdate],
  )

  const currentModeLabel = getTextFilterModeLabel(condition.mode)

  return (
    <div className="flex items-start gap-2">
      {/* Mode dropdown */}
      <div className="flex-shrink-0">
        {variant === "mobile" ? (
          <select
            aria-label="Text filter operator"
            className="h-10 w-28 rounded-md border bg-background px-2 text-base text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onUpdate(index, { mode: event.target.value as TextFilterMode })}
            value={condition.mode}
          >
            {TEXT_FILTER_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <SearchableDropdown
            open={modeDropdownOpen}
            onOpenChange={setModeDropdownOpen}
            items={TEXT_FILTER_MODE_OPTIONS}
            getItemKey={(option) => option.value}
            renderItem={(option) => option.label}
            onSelect={handleModeSelect}
            filterFn={(opt, search) => opt.label.toLowerCase().includes(search.toLowerCase())}
            searchPlaceholder="Search"
            emptyText="No modes found"
            align="start"
            width="w-48"
            contentClassName="z-[130]"
            variant={variant}
          >
            <button
              type="button"
              className="inline-flex h-8 w-[110px] items-center justify-center rounded-md border bg-transparent px-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-xs text-muted-foreground">{currentModeLabel}</span>
            </button>
          </SearchableDropdown>
        )}
      </div>

      {/* Value input */}
      <div className="flex-1">
        <Input
          value={condition.value}
          onChange={(e) => onUpdate(index, { value: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Enter text..."
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
