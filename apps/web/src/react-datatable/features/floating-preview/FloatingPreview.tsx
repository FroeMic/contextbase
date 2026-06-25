import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../components/ui/button"
import { CloseIcon } from "../../components/ui/icons"
import type { DatatableRowPreviewConfig } from "../../types/props.types"
import {
  clampFloatingPreviewPosition,
  type FloatingPreviewPosition,
  getDefaultFloatingPreviewPosition,
  getFloatingPreviewStorageKey,
  parseStoredFloatingPreviewPosition,
} from "./floating-preview-position"

interface FloatingPreviewProps<TData> {
  open: boolean
  rowId: string | null
  row: TData | null
  onClose: () => void
  floating?: DatatableRowPreviewConfig<TData>["floating"]
  anchorPoint?: FloatingPreviewPosition | null
  tableKey?: string
  renderPreview: (info: { row: TData; rowId: string; close: () => void }) => ReactNode
}

const DEFAULT_PANEL_WIDTH = 432
const MIN_PANEL_WIDTH = 320
const DEFAULT_PANEL_HEIGHT = 640
const MIN_PANEL_HEIGHT = 240
const VIEWPORT_PADDING = 16

function getViewportMetrics() {
  if (typeof window === "undefined") {
    return {
      viewportWidth: 1280,
      viewportHeight: 900,
    }
  }

  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }
}

function getPanelMetrics(floating?: DatatableRowPreviewConfig<unknown>["floating"]) {
  const { viewportWidth, viewportHeight } = getViewportMetrics()
  const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth - VIEWPORT_PADDING * 2)
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewportHeight - VIEWPORT_PADDING * 2)

  return {
    viewportWidth,
    viewportHeight,
    panelWidth: Math.min(
      maxWidth,
      Math.max(MIN_PANEL_WIDTH, floating?.width ?? DEFAULT_PANEL_WIDTH),
    ),
    panelHeight: Math.min(
      maxHeight,
      Math.max(MIN_PANEL_HEIGHT, floating?.height ?? DEFAULT_PANEL_HEIGHT),
    ),
  }
}

export function FloatingPreview<TData>({
  open,
  rowId,
  row,
  onClose,
  floating,
  anchorPoint,
  tableKey,
  renderPreview,
}: FloatingPreviewProps<TData>) {
  const draggable = floating?.draggable ?? true
  const [position, setPosition] = useState<FloatingPreviewPosition | null>(null)
  const [panelMetrics, setPanelMetrics] = useState(() => getPanelMetrics(floating))
  const dragStateRef = useRef<{
    pointerStartX: number
    pointerStartY: number
    originX: number
    originY: number
  } | null>(null)

  const { viewportWidth, viewportHeight, panelWidth, panelHeight } = panelMetrics
  const storageKey = tableKey ? getFloatingPreviewStorageKey(tableKey) : null
  const defaultPosition = useMemo(
    () =>
      getDefaultFloatingPreviewPosition({
        viewportWidth,
        viewportHeight,
        panelWidth,
        panelHeight,
        anchorPoint,
      }),
    [anchorPoint, panelHeight, panelWidth, viewportHeight, viewportWidth],
  )

  const persistPosition = useCallback(
    (nextPosition: FloatingPreviewPosition) => {
      if (!storageKey || typeof window === "undefined") {
        return
      }

      window.sessionStorage.setItem(storageKey, JSON.stringify(nextPosition))
    },
    [storageKey],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    if (!storageKey || typeof window === "undefined") {
      setPosition(defaultPosition)
      return
    }

    const storedPosition = parseStoredFloatingPreviewPosition(
      window.sessionStorage.getItem(storageKey),
    )
    setPosition(
      clampFloatingPreviewPosition({
        position: storedPosition ?? defaultPosition,
        viewportWidth,
        viewportHeight,
        panelWidth,
        panelHeight,
      }),
    )
  }, [
    defaultPosition,
    open,
    panelHeight,
    panelWidth,
    storageKey,
    viewportHeight,
    viewportWidth,
  ])

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return
    }

    const handleResize = () => {
      const nextMetrics = getPanelMetrics(floating)
      setPanelMetrics(nextMetrics)
      setPosition((current) => {
        if (!current) {
          return current
        }

        const nextPosition = clampFloatingPreviewPosition({
          position: current,
          viewportWidth: nextMetrics.viewportWidth,
          viewportHeight: nextMetrics.viewportHeight,
          panelWidth: nextMetrics.panelWidth,
          panelHeight: nextMetrics.panelHeight,
        })
        persistPosition(nextPosition)
        return nextPosition
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [floating, open, persistPosition])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      setPosition(
        clampFloatingPreviewPosition({
          position: {
            x: dragState.originX + (event.clientX - dragState.pointerStartX),
            y: dragState.originY + (event.clientY - dragState.pointerStartY),
          },
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          panelWidth,
          panelHeight,
        }),
      )
    }

    const handleMouseUp = () => {
      if (!dragStateRef.current) {
        return
      }

      dragStateRef.current = null
      setPosition((current) => {
        if (current) {
          persistPosition(current)
        }
        return current
      })
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [panelHeight, panelWidth, persistPosition])

  const handleDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!draggable || !position) {
        return
      }

      event.preventDefault()

      dragStateRef.current = {
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        originX: position.x,
        originY: position.y,
      }
    },
    [draggable, position],
  )

  const resolvedPosition = position ?? defaultPosition

  if (!open || !rowId || !row) {
    return null
  }

  const content = (
    <div
      data-slot="datatable-preview-portal"
      className="pointer-events-none fixed z-[120]"
      style={{
        left: resolvedPosition.x,
        top: resolvedPosition.y,
        width: panelWidth,
        height: panelHeight,
      }}
    >
      <div className="pointer-events-auto relative h-full w-full overflow-hidden rounded-xl border bg-background shadow-xl">
        <div
          className="border-border/70 text-muted-foreground flex h-9 items-center justify-end border-b px-2"
          onMouseDown={handleDragStart}
          style={{
            cursor: draggable ? "grab" : "default",
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
            aria-label="Close preview"
          >
            <CloseIcon size={16} />
          </Button>
        </div>

        <div className="h-[calc(100%-2.25rem)] overflow-auto p-6">
          {renderPreview({ row, rowId, close: onClose })}
        </div>
      </div>
    </div>
  )

  if (typeof document === "undefined") {
    return content
  }

  return createPortal(content, document.body)
}
