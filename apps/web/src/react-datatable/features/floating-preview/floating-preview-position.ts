export interface FloatingPreviewPosition {
  x: number
  y: number
}

const VIEWPORT_PADDING = 16
const DEFAULT_HORIZONTAL_THIRD_START = 2 / 3
const DEFAULT_VERTICAL_THIRD_START = 1 / 3
const DEFAULT_MOUSE_HORIZONTAL_OFFSET = 24

export function getDefaultFloatingPreviewPosition({
  viewportWidth,
  viewportHeight,
  panelWidth,
  panelHeight,
  anchorPoint,
}: {
  viewportWidth: number
  viewportHeight: number
  panelWidth: number
  panelHeight: number
  anchorPoint?: FloatingPreviewPosition | null
}): FloatingPreviewPosition {
  return clampFloatingPreviewPosition({
    position: {
      x: anchorPoint
        ? anchorPoint.x + DEFAULT_MOUSE_HORIZONTAL_OFFSET
        : viewportWidth * DEFAULT_HORIZONTAL_THIRD_START,
      y: viewportHeight * DEFAULT_VERTICAL_THIRD_START,
    },
    viewportWidth,
    viewportHeight,
    panelWidth,
    panelHeight,
  })
}

export function clampFloatingPreviewPosition({
  position,
  viewportWidth,
  viewportHeight,
  panelWidth,
  panelHeight,
}: {
  position: FloatingPreviewPosition
  viewportWidth: number
  viewportHeight: number
  panelWidth: number
  panelHeight: number
}): FloatingPreviewPosition {
  return {
    x: Math.min(
      Math.max(position.x, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, viewportWidth - panelWidth - VIEWPORT_PADDING),
    ),
    y: Math.min(
      Math.max(position.y, VIEWPORT_PADDING),
      Math.max(VIEWPORT_PADDING, viewportHeight - panelHeight - VIEWPORT_PADDING),
    ),
  }
}

export function getFloatingPreviewStorageKey(tableKey: string) {
  return `datatable:preview-position:${tableKey}`
}

export function parseStoredFloatingPreviewPosition(
  rawValue: string | null,
): FloatingPreviewPosition | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<FloatingPreviewPosition>
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return null
    }

    return {
      x: parsed.x,
      y: parsed.y,
    }
  } catch {
    return null
  }
}
