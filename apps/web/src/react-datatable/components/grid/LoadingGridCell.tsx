import { memo } from "react"

interface LoadingGridCellProps {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  showVerticalLine?: boolean
  showHorizontalLine?: boolean
}

export const LoadingGridCell = memo(function LoadingGridCell({
  x,
  y,
  width,
  height,
  zIndex,
  showVerticalLine = true,
  showHorizontalLine = true,
}: LoadingGridCellProps) {
  return (
    <div
      role="gridcell"
      aria-busy="true"
      className="bg-background"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        zIndex,
        boxSizing: "border-box",
        borderRight: showVerticalLine ? "1px solid var(--border)" : undefined,
        borderBottom: showHorizontalLine ? "1px solid var(--border)" : "1px solid transparent",
        padding: 8,
      }}
    >
      <div
        className="bg-muted"
        style={{
          width: "70%",
          height: 10,
          borderRadius: 999,
          opacity: 0.7,
        }}
      />
    </div>
  )
})
