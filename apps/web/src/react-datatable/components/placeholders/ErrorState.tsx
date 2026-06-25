import { Button } from "../ui/button"
import { type Icon, WarningCircleIcon } from "../ui/icons"

/**
 * Error state component for Datatable
 *
 * Displays when data fetching fails.
 * Provides error message and optional retry action.
 *
 * @example
 * ```tsx
 * if (error) {
 *   return (
 *     <ErrorState
 *       title="Failed to load contacts"
 *       message={error.message}
 *       onRetry={() => refetch()}
 *     />
 *   )
 * }
 * ```
 */
export interface ErrorStateProps {
  /** Error title (default: "Failed to load data") */
  title?: string

  /** Error message (default: "Something went wrong") */
  message?: string

  /** Optional retry callback (shows "Try again" button if provided) */
  onRetry?: () => void

  /** Custom retry button text (default: "Try again") */
  retryButtonText?: string

  /** Custom icon (default: WarningCircleIcon) */
  icon?: Icon
}

export function ErrorState({
  title = "Failed to load data",
  message = "Something went wrong. Please try again.",
  onRetry,
  retryButtonText = "Try again",
  icon: Icon = WarningCircleIcon,
}: ErrorStateProps) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className="rounded-full bg-destructive/10 p-4">
        <Icon className="h-8 w-8 text-destructive" weight="duotone" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {/* Message */}
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>

      {/* Retry button (if callback provided) */}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryButtonText}
        </Button>
      )}
    </div>
  )
}
