import type { Header } from "@tanstack/react-table"
import { useCallback, useEffect, useRef } from "react"
import { useDatatableResizeSession } from "../../core/ColumnResizeSessionContext"
import { useDatatableStoreApi } from "../../state/store/use-datatable-store"
import { shouldCleanupResizeSession } from "./should-cleanup-resize-session"

interface ResizeHandleProps<TData> {
  header: Header<TData, unknown>
  onHoverChange?: (isHovered: boolean) => void
}

/**
 * Column resize handle component
 *
 * Uses TanStack Table's built-in resize handler for mouse/touch events.
 * Provides visual feedback during drag with color change.
 * Fully keyboard accessible with arrow keys.
 *
 * Pattern: Positioned absolutely at right edge of header cell.
 * UX: Document-level cursor management, rounded || indicator on hover
 * Accessibility: ARIA separator role, keyboard navigation, screen reader support
 */
export function ResizeHandle<TData>({ header, onHoverChange }: ResizeHandleProps<TData>) {
  const { column } = header
  const store = useDatatableStoreApi()
  const { activeResizeSession, setActiveResizeSession } = useDatatableResizeSession()
  const isResizing = activeResizeSession?.columnId === column.id

  // Get column metadata for ARIA attributes
  const columnHeader =
    typeof column.columnDef.header === "string" ? column.columnDef.header : column.id
  const minSize = column.columnDef.minSize ?? 50
  const maxSize = column.columnDef.maxSize ?? 1000
  const currentSize = isResizing ? activeResizeSession.previewWidth : column.getSize()
  const rafRef = useRef<number | null>(null)
  const pointerClientXRef = useRef<number | null>(null)
  const sessionRef = useRef(activeResizeSession)
  const pointerMoveListenerRef = useRef<(event: PointerEvent) => void>(() => {})
  const pointerUpListenerRef = useRef<() => void>(() => {})
  const pointerCancelListenerRef = useRef<() => void>(() => {})

  sessionRef.current = activeResizeSession

  const commitColumnWidth = useCallback(
    (nextWidth: number) => {
      header.getContext().table.setColumnSizing((old) => ({
        ...old,
        [column.id]: nextWidth,
      }))
      store.getState().setColumnWidth(column.id, nextWidth)
    },
    [column.id, header, store],
  )

  const updatePreviewWidth = useCallback(() => {
    rafRef.current = null

    const session = sessionRef.current
    const pointerClientX = pointerClientXRef.current

    if (!session || session.columnId !== column.id || pointerClientX === null) {
      return
    }

    const rawWidth = session.startWidth + (pointerClientX - session.startClientX)
    const previewWidth = Math.min(Math.max(rawWidth, session.minWidth), session.maxWidth)

    if (previewWidth === session.previewWidth) {
      return
    }

    const nextSession = {
      ...session,
      previewWidth,
    }

    sessionRef.current = nextSession
    setActiveResizeSession((current) => (current?.columnId === column.id ? nextSession : current))
  }, [column.id, setActiveResizeSession])

  const cleanupDragSession = useCallback(
    (shouldCommit: boolean) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const session = sessionRef.current

      if (shouldCommit && session && session.columnId === column.id) {
        commitColumnWidth(session.previewWidth)
      }

      pointerClientXRef.current = null
      sessionRef.current = null
      setActiveResizeSession((current) => (current?.columnId === column.id ? null : current))
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("pointermove", pointerMoveListenerRef.current)
      window.removeEventListener("pointerup", pointerUpListenerRef.current)
      window.removeEventListener("pointercancel", pointerCancelListenerRef.current)
    },
    [column.id, commitColumnWidth, setActiveResizeSession],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      pointerClientXRef.current = event.clientX

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updatePreviewWidth)
      }
    },
    [updatePreviewWidth],
  )

  const handlePointerUp = useCallback(() => {
    cleanupDragSession(true)
  }, [cleanupDragSession])

  const handlePointerCancel = useCallback(() => {
    cleanupDragSession(false)
  }, [cleanupDragSession])

  pointerMoveListenerRef.current = handlePointerMove
  pointerUpListenerRef.current = handlePointerUp
  pointerCancelListenerRef.current = handlePointerCancel

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const startWidth = column.getSize()
      const nextSession = {
        columnId: column.id,
        startClientX: event.clientX,
        startWidth,
        previewWidth: startWidth,
        minWidth: minSize,
        maxWidth: maxSize,
      }

      pointerClientXRef.current = event.clientX
      sessionRef.current = nextSession
      setActiveResizeSession(nextSession)

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
      window.addEventListener("pointercancel", handlePointerCancel)
    },
    [
      column,
      handlePointerCancel,
      handlePointerMove,
      handlePointerUp,
      maxSize,
      minSize,
      setActiveResizeSession,
    ],
  )

  // Keyboard resize handler (arrow keys)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 10 // pixels to resize per key press
      let newSize: number | undefined

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          newSize = Math.max(minSize, currentSize - step)
          commitColumnWidth(newSize)
          break
        case "ArrowRight":
          e.preventDefault()
          newSize = Math.min(maxSize, currentSize + step)
          commitColumnWidth(newSize)
          break
        case "Home":
          e.preventDefault()
          commitColumnWidth(minSize)
          break
        case "End":
          e.preventDefault()
          commitColumnWidth(maxSize)
          break
      }
    },
    [commitColumnWidth, currentSize, maxSize, minSize],
  )

  // Manage document cursor during resize to prevent flickering
  useEffect(() => {
    return () => {
      if (!shouldCleanupResizeSession(sessionRef.current, column.id)) {
        return
      }

      cleanupDragSession(false)
    }
  }, [cleanupDragSession, column.id])

  // Don't render if column resizing is disabled
  if (!column.getCanResize()) {
    return null
  }

  return (
    <div
      role="separator"
      aria-label={`Resize ${columnHeader} column`}
      aria-orientation="vertical"
      aria-valuenow={currentSize}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className="absolute top-0 flex h-full cursor-col-resize touch-none items-center justify-center transition-opacity select-none focus:outline-none"
      style={{
        right: "-8px", // Position to overlap with column border
        width: "16px", // Wider hit area for easier grabbing
        zIndex: 10,
        opacity: isResizing ? 1 : undefined, // Keep visible during drag
        pointerEvents: "auto", // Ensure resize handle receives events despite drag handle
      }}
    >
      {/* Visual indicator - || symbol, larger with rounded ends */}
      <div
        className="flex gap-[3px] opacity-0 hover:opacity-100"
        style={{ opacity: isResizing ? 1 : undefined }}
      >
        <div className="bg-muted-foreground h-4 w-[2px] rounded-full" />
        <div className="bg-muted-foreground h-4 w-[2px] rounded-full" />
      </div>
    </div>
  )
}
