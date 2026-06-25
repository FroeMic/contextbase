import { Button } from "../ui/button"
import { type Icon, MagnifyingGlassIcon } from "../ui/icons"

/**
 * Empty state component for Datatable
 *
 * Displays when no data is available (after loading completes).
 * Provides helpful messaging and optional reset action.
 *
 * @example
 * ```tsx
 * if (data.length === 0 && !isLoading) {
 *   return (
 *     <EmptyState
 *       title="No contacts found"
 *       message="Try adjusting your filters or search query"
 *       onReset={() => clearAllFilters()}
 *     />
 *   )
 * }
 * ```
 */
export interface EmptyStateProps {
  /** Title text (default: "No results") */
  title?: string

  /** Description message (default: "Try adjusting your filters") */
  message?: string

  /** Optional reset callback (shows "Clear filters" button if provided) */
  onReset?: () => void

  /** Custom reset button text (default: "Clear filters") */
  resetButtonText?: string

  /** Custom icon (default: MagnifyingGlassIcon) */
  icon?: Icon
}

export function EmptyState({
  title = "No results",
  message = "Try adjusting your filters",
  onReset,
  resetButtonText = "Clear filters",
  icon: Icon = MagnifyingGlassIcon,
}: EmptyStateProps) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center"
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" weight="duotone" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {/* Message */}
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>

      {/* Reset button (if callback provided) */}
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset}>
          {resetButtonText}
        </Button>
      )}
    </div>
  )
}
