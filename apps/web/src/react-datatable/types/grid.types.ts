import type { Cell } from "@tanstack/react-table"
import type { DatatableColumn } from "./column.types"
import type { RenderableRow } from "./renderable-row.types"

/**
 * Information about a single grid cell's position and dimensions
 */
export interface GridCellInfo {
  /** Absolute left position in pixels */
  x: number
  /** Absolute top position in pixels */
  y: number
  /** Cell width in pixels */
  width: number
  /** Cell height in pixels */
  height: number
  /** Logical row index (includes header row at index 0) */
  rowIndex: number
  /** Logical column index */
  columnIndex: number
  /** Z-index for stacking order */
  zIndex: number
  /** Whether this cell is in a frozen column */
  isFrozenColumn: boolean
  /** Whether this cell is in a frozen row (header) */
  isFrozenRow: boolean
}

/**
 * Quadrant boundaries for 4-grid system
 * Used to position frozen and scrollable regions
 */
export interface QuadrantDimensions {
  topLeft: { width: number; height: number }
  topRight: { width: number; height: number }
  bottomLeft: { width: number; height: number }
  bottomRight: { width: number; height: number }
}

/**
 * Configuration for layout calculation
 */
export interface LayoutConfig<TData = unknown> {
  // Data
  renderableRows: RenderableRow<TData>[]
  columns: DatatableColumn<TData>[]

  // Sizing
  rowHeight: number
  headerHeight: number
  groupHeaderHeight: number
  getColumnWidth: (columnId: string) => number

  // Frozen
  frozenColumnsCount: number
  frozenRowsCount: number // Always 1 for header

  // Column order
  columnOrder: string[]

  // Buffer width in pixels to add to total width (e.g., for ViewColumnsButton)
  widthBuffer?: number

  // Viewport (for virtualized mode)
  viewport?: {
    scrollLeft: number
    scrollTop: number
    width: number
    height: number
  }
}

/**
 * Result of layout calculation
 */
export interface LayoutResult {
  /** Cells to render (all cells for static mode, visible cells for virtualized mode) */
  cells: GridCellInfo[]

  /** Total content dimensions */
  totalWidth: number
  totalHeight: number

  /** Frozen region dimensions */
  frozenWidth: number
  frozenHeight: number

  /** Quadrant boundaries for 4-grid rendering */
  quadrants: QuadrantDimensions
}

/**
 * Render mode for the datatable
 */
export type RenderMode = "virtualized" | "static"

/**
 * Cell matrix for O(1) cell lookups
 * Key format: "rowIndex-columnIndex"
 */
export type CellMatrix<TData> = Map<string, Cell<TData, unknown>>

/**
 * A single grid line (vertical or horizontal separator)
 */
export interface GridLine {
  /** Unique identifier for React keys */
  id: string
  /** Line orientation */
  type: "vertical" | "horizontal"
  /** Absolute position (x for vertical, y for horizontal) */
  position: number
  /** Where the line starts (y for vertical, x for horizontal) */
  start: number
  /** Line length (height for vertical, width for horizontal) */
  length: number
}

/**
 * Result of grid line calculation
 */
export interface GridLinesResult {
  /** Vertical lines (column separators) */
  vertical: GridLine[]
  /** Horizontal lines (row separators) */
  horizontal: GridLine[]
}
