/**
 * Global constants for Datatable component
 */

/**
 * Z-index layering system for table elements
 * Higher values appear above lower values
 */
export const Z_INDEX = {
  /** Base z-index for sticky table header (non-sticky columns) */
  HEADER: 10,
  /** Z-index for sticky body cells (frozen columns) */
  STICKY_CELL: 11,
  /** Z-index for sticky header cells (intersection of frozen columns and header row) */
  STICKY_HEADER: 20,
  /** Z-index for column being resized or resize handle hovered */
  RESIZING_COLUMN: 100,
  /** Z-index for column being dragged during reordering */
  DRAGGING_COLUMN: 999,
  /** Z-index for resize handle overlay (must be above all table elements) */
  RESIZE_OVERLAY: 9999,

  /** Grid rendering z-index layers (for grid-based virtualization) */
  GRID: {
    /** Bottom-right quadrant - scrollable data cells */
    SCROLLABLE_DATA: 10,
    /** Bottom-left quadrant - frozen column data cells */
    FROZEN_COLUMNS: 20,
    /** Top-right quadrant - scrollable header cells */
    SCROLLABLE_HEADER: 40,
    /** Grid lines overlay - visual separators between cells */
    GRID_LINES: 25,
    /** Full-width row overlay - used for grouped rows and other non-cell rows */
    FULL_WIDTH_ROWS: 36,
    /** Top-left quadrant - frozen header cells (intersection) */
    FROZEN_HEADER: 41,
    /** Frozen boundaries - lines marking frozen/scrollable split */
    FROZEN_BOUNDARIES: 45,
  },
} as const

/**
 * Maximum number of columns that can be frozen (sticky)
 * Limitation for UX - too many frozen columns reduces available scroll area
 */
export const MAX_STICKY_COLUMNS = 5

/**
 * Default label for when no columns are frozen
 */
export const NO_FROZEN_COLUMN_LABEL = "No Frozen Column"

/**
 * Box shadow for sticky columns
 * Creates visual separation between frozen and scrollable columns
 */
export const STICKY_COLUMN_SHADOW = "" // set to "" otherwise it doesn't look good with grouping headers

/**
 * Drag activation distance for column reordering
 * Requires 8px movement before drag activates (prevents accidental drags when clicking sort/resize)
 */
export const DRAG_ACTIVATION_DISTANCE = 8

/**
 * Default width in pixels for the View Columns Button
 * Used for layout calculations and spacing
 */
export const VIEW_COLUMNS_BUTTON_WIDTH = 24
