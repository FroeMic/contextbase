export interface AxisRange {
  startIndex: number
  endIndex: number
}

export type ViewportRenderMode = "viewport" | "full"

export interface AxisVisibleRangeSet {
  rendered: AxisRange | null
  visible: AxisRange | null
  fullyVisible: AxisRange | null
}

export interface ViewportSnapshot {
  scrollLeft: number
  scrollTop: number
  width: number
  height: number
}

export interface PaneAxisRanges {
  rows: AxisRange | null
  columns: AxisRange | null
}

export interface PaneRanges {
  topLeft: PaneAxisRanges
  topRight: PaneAxisRanges
  bottomLeft: PaneAxisRanges
  bottomRight: PaneAxisRanges
}

export interface ViewportLayoutResult {
  rows: AxisVisibleRangeSet
  columns: AxisVisibleRangeSet
  panes: PaneRanges
  totalWidth: number
  totalHeight: number
  frozenWidth: number
  frozenHeight: number
}
