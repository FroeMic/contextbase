import { useRef } from "react"
import { Checkbox } from "../../components/ui/checkbox"
import { cn } from "../../shared/utils/cn"

interface SelectionGridCellProps {
  x: number
  y: number
  width: number
  height: number
  checked: boolean
  className?: string
  rowId?: string
  isActive?: boolean
  disabled?: boolean
  renderCheckbox?: boolean
  showVerticalLine?: boolean
  showHorizontalLine?: boolean
  showCheckbox?: boolean
  interactionAttributes?: Record<string, unknown>
  onActivate?: () => void
  onToggle?: (params: { checked: boolean; shiftKey: boolean }) => void
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>
}

export function SelectionGridCell({
  x,
  y,
  width,
  height,
  checked,
  className,
  rowId,
  isActive = false,
  disabled = false,
  renderCheckbox = true,
  showVerticalLine = true,
  showHorizontalLine = true,
  showCheckbox = true,
  interactionAttributes,
  onActivate,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: SelectionGridCellProps) {
  const lastShiftKeyRef = useRef(false)

  return (
    <div
      role="gridcell"
      aria-selected={checked || undefined}
      data-row-id={rowId}
      data-selected={checked || undefined}
      data-active={isActive || undefined}
      data-hover-reveals-checkbox={!showCheckbox || undefined}
      className={cn("group/selection-cell bg-transparent", className)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        zIndex: 2,
        boxSizing: "border-box",
        borderRight: showVerticalLine ? "1px solid var(--border)" : undefined,
        borderBottom: showHorizontalLine ? "1px solid var(--border)" : "1px solid transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onActivate}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...interactionAttributes}
    >
      {renderCheckbox && (
        <Checkbox
          className={cn(
            "h-3.5 w-3.5 transition-opacity",
            !showCheckbox &&
              "pointer-events-none opacity-0 group-data-[hovered=true]/selection-cell:pointer-events-auto group-data-[hovered=true]/selection-cell:opacity-100",
          )}
          checked={checked}
          disabled={disabled}
          onClick={(event) => {
            lastShiftKeyRef.current = event.shiftKey
            onActivate?.()
          }}
          onCheckedChange={(next) =>
            onToggle?.({
              checked: next === true,
              shiftKey: lastShiftKeyRef.current,
            })
          }
        />
      )}
    </div>
  )
}
