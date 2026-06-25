import { Component, type ErrorInfo, type ReactNode } from "react"

interface GridErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface GridErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary for Grid Rendering
 *
 * Catches errors during grid rendering and displays a fallback UI with retry option.
 * Prevents the entire application from crashing due to grid rendering failures.
 *
 * Usage:
 * ```tsx
 * <GridErrorBoundary>
 *   <VirtualizedGrid {...props} />
 * </GridErrorBoundary>
 * ```
 */
export class GridErrorBoundary extends Component<GridErrorBoundaryProps, GridErrorBoundaryState> {
  constructor(props: GridErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): GridErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GridErrorBoundary] Grid rendering error:", error, errorInfo)
  }

  componentDidUpdate(prevProps: GridErrorBoundaryProps) {
    // Reset error state when children change (e.g., during HMR/Fast Refresh)
    // This prevents error boundary from staying in error state after hot reload
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold mb-2">Failed to render grid</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {this.state.error?.message || "An error occurred while rendering the table"}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
