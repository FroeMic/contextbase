/**
 * Loading state component for Datatable
 *
 * Displays a skeleton loader while data is being fetched.
 * Used during initial load in online mode.
 *
 * @example
 * ```tsx
 * if (onlineQuery?.isLoading) {
 *   return <LoadingState rowCount={10} columnCount={columns.length} />
 * }
 * ```
 */
export interface LoadingStateProps {
  /** Number of skeleton rows to display (default: 10) */
  rowCount?: number

  /** Number of skeleton cells per row (default: 5) */
  columnCount?: number

  /** Row height in pixels (should match table rowHeight) */
  rowHeight?: number

  /** Optional loading message */
  message?: string
}

export function LoadingState({
  rowCount = 10,
  columnCount = 5,
  rowHeight = 40,
  message = "Loading...",
}: LoadingStateProps) {
  const headerWidths = Array.from({ length: columnCount }, (_, index) => {
    const widths = ["w-28", "w-20", "w-32", "w-24", "w-24", "w-16"]
    return widths[index % widths.length]
  })

  return (
    <div className="bg-card overflow-hidden rounded-lg border" role="status" aria-label={message}>
      <div className="grid grid-rows-[64px_48px_48px_1fr] overflow-hidden bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <div className="h-8 w-56 animate-pulse rounded-full bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
          <div className="ml-auto h-8 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-10 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-center gap-2 border-b border-border px-4 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <span>{message}</span>
        </div>

        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {headerWidths.map((width, index) => (
            <div
              className="flex items-center px-4"
              key={`header-${index}`}
              style={{ height: `${rowHeight}px` }}
            >
              <div className={`h-4 animate-pulse rounded-full bg-muted ${width}`} />
            </div>
          ))}
        </div>

        <div className="overflow-hidden">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid border-b border-border last:border-b-0"
              style={{
                height: `${rowHeight}px`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {headerWidths.map((width, colIndex) => (
                <div className="flex items-center px-4" key={colIndex}>
                  <div
                    className={`h-3.5 animate-pulse rounded-full bg-muted ${width}`}
                    style={{ animationDelay: `${(rowIndex * columnCount + colIndex) * 40}ms` }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
