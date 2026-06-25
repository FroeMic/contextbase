import { useCallback, useEffect, useRef, useState } from "react"
import {
  COLUMN_WIDTH_DEFAULTS,
  getColumnMaxWidth,
  getColumnMinWidth,
} from "../../core/column-sizing/column-width"
import { cn } from "../../shared/utils/cn"
import type { DatatableColumn } from "../../types/column.types"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog"
import { ArrowCounterClockwiseIcon } from "../ui/icons"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

interface ResizeColumnDialogProps<TData> {
  column: DatatableColumn<TData> | null
  open: boolean
  onClose: () => void
  currentWidth: number
  onApply: (width: number) => void
  onReset: () => void
}

/**
 * Resize Column Dialog Component
 *
 * Modal dialog for setting custom column width with:
 * - Number input with current width value
 * - Min/max constraints from column definition
 * - Reset button to restore default width
 * - Display of current, default, and range values
 */
export function ResizeColumnDialog<TData>({
  column,
  open,
  onClose,
  currentWidth,
  onApply,
  onReset,
}: ResizeColumnDialogProps<TData>) {
  const [inputValue, setInputValue] = useState(String(currentWidth))
  const [pendingWidth, setPendingWidth] = useState<number>(currentWidth)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const minWidth = column ? getColumnMinWidth(column) : COLUMN_WIDTH_DEFAULTS.MIN
  const maxWidth = column ? getColumnMaxWidth(column) : COLUMN_WIDTH_DEFAULTS.MAX
  const defaultWidth = column?.width ?? COLUMN_WIDTH_DEFAULTS.DEFAULT

  // Sync input value when dialog opens or currentWidth prop changes
  useEffect(() => {
    if (open) {
      setInputValue(String(currentWidth))
      setPendingWidth(currentWidth)
      setError(null)

      // Focus input after a short delay to ensure dialog is fully rendered
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select() // Select text for easy replacement
      }, 0)
    }
  }, [currentWidth, open])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)

      const numValue = parseInt(value, 10)

      // Validate input
      if (value === "" || isNaN(numValue)) {
        setError("Please enter a valid number")
        return
      }

      if (numValue < minWidth) {
        setError(`Minimum width is ${minWidth}px`)
        return
      }

      if (numValue > maxWidth) {
        setError(`Maximum width is ${maxWidth}px`)
        return
      }

      // Valid value - clear error and stage the change
      setError(null)
      setPendingWidth(numValue)
    },
    [minWidth, maxWidth],
  )

  const handleApply = useCallback(() => {
    if (error) {
      return
    }
    onApply(pendingWidth)
    onClose()
  }, [error, pendingWidth, onApply, onClose])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    setInputValue(String(defaultWidth))
    setPendingWidth(defaultWidth)
    setError(null)
    onReset()
    onClose()
  }, [defaultWidth, onReset, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only stop propagation for keys we handle (Enter, Escape)
      // This prevents keyboard events from bubbling to table header sort/drag handlers
      // Otherwise Enter might trigger column sort, Arrow keys might trigger drag
      if (e.key === "Enter" || e.key === "Escape") {
        e.stopPropagation()
        e.preventDefault()

        if (e.key === "Enter") {
          // Only apply if validation passes
          if (!error) {
            handleApply()
          }
          // If there's an error, do nothing (user sees error message)
        } else if (e.key === "Escape") {
          handleCancel()
        }
      }
      // Don't stop propagation for Tab, Arrow keys, etc. to preserve navigation
    },
    [error, handleApply, handleCancel],
  )

  if (!column) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="p-0 sm:max-w-md">
        {/* Visible dialog title for accessibility (WCAG 2.4.6) */}
        <DialogTitle className="text-sm font-semibold px-2.5 pt-2.5">
          Resize Column: {column.header}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Set custom width for the {column.header} column
        </DialogDescription>

        <div className="space-y-3 px-2.5 pb-2.5">
          {/* Width input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Width (px)</Label>
            <Input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              min={minWidth}
              max={maxWidth}
              className="h-8 text-xs"
            />
            {/* Error message with fixed height to prevent layout shift */}
            <p className="text-destructive text-xs h-4">{error || "\u00A0"}</p>
          </div>

          {/* Info display */}
          <div className="text-muted-foreground text-xs">
            Range: {minWidth} - {maxWidth} • Default: {defaultWidth}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowCounterClockwiseIcon className="mr-1.5 h-3.5 w-3.5" />
              Reset to Default
            </Button>
            <div className={cn("flex gap-2", "ml-auto")}>
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} disabled={!!error} className="text-xs">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
