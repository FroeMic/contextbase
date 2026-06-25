import { useEffect, useRef, useState } from "react"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import { Button } from "../ui/button"
import { CloseIcon } from "../ui/icons"
import { Input } from "../ui/input"

export interface QuickSearchConfig {
  placeholder?: string
  debounceMs?: number
}

interface QuickSearchProps {
  config?: QuickSearchConfig
}

/**
 * QuickSearch component
 *
 * Global search input with debouncing and keyboard shortcuts.
 * - Cmd+F / Ctrl+F focuses input
 * - Escape clears and blurs
 * - Debounced updates to prevent excessive re-renders
 *
 * Internal component - not exported from package
 */
export const QuickSearch = ({ config = {} }: QuickSearchProps) => {
  const { placeholder = "Search...", debounceMs = 300 } = config

  // Store state
  const globalFilter = useDatatableStore((s) => s.globalFilter)
  const setGlobalFilter = useDatatableStore((s) => s.setGlobalFilter)

  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(globalFilter)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce: local value → store (triggers table filtering)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== globalFilter) {
        setGlobalFilter(localValue)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [localValue, debounceMs, globalFilter, setGlobalFilter])

  // Sync from store (e.g., URL changes, programmatic updates)
  useEffect(() => {
    if (globalFilter !== localValue) {
      setLocalValue(globalFilter)
    }
    // Intentionally omit localValue from deps to avoid sync loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter])

  // Keyboard shortcuts: Cmd+F and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in another input/textarea (but not ours)
      if (
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) &&
        e.target !== inputRef.current
      ) {
        return
      }

      // Cmd+F / Ctrl+F → Focus input
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Escape → Clear and blur (only if our input is focused)
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault()
        setLocalValue("")
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleClear = () => {
    setLocalValue("")
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-54 max-sm:w-full">
      <Input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          DATATABLE_MOBILE_SEARCH_INPUT_CLASS,
          "placeholder:text-muted-foreground flex w-full ring-0 outline-none focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          localValue && "pr-8",
        )}
      />

      {/* Clear button */}
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute top-1/2 right-0.5 h-7 w-7 -translate-y-1/2 p-0 hover:bg-transparent"
          aria-label="Clear search"
        >
          <CloseIcon className="text-muted-foreground hover:text-foreground h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
