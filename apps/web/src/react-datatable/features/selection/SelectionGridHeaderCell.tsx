import { Checkbox } from "../../components/ui/checkbox"

interface SelectionGridHeaderCellProps {
  x: number
  y: number
  width: number
  height: number
  checked?: boolean
  indeterminate?: boolean
  disabled?: boolean
  renderCheckbox?: boolean
  showVerticalLine?: boolean
  showHorizontalLine?: boolean
  onToggle?: () => void
}

export function SelectionGridHeaderCell({
  x,
  y,
  width,
  height,
  checked = false,
  indeterminate = false,
  disabled = false,
  renderCheckbox = true,
  showVerticalLine = true,
  showHorizontalLine = true,
  onToggle,
}: SelectionGridHeaderCellProps) {
  return (
    <div
      role="columnheader"
      aria-label="Row selection"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        zIndex: 3,
        boxSizing: "border-box",
        backgroundColor: "var(--background)",
        borderRight: showVerticalLine ? "1px solid var(--border)" : undefined,
        borderBottom: showHorizontalLine ? "1px solid var(--border)" : "1px solid transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {renderCheckbox && (
        <Checkbox
          className="h-3.5 w-3.5"
          checked={indeterminate ? "indeterminate" : checked}
          disabled={disabled}
          aria-label="Select loaded rows"
          onCheckedChange={() => onToggle?.()}
        />
      )}
    </div>
  )
}
