export type ColumnDragWidthMorphMode = "none" | "snap" | "interpolate"

interface GetOverlayMorphWidthArgs {
  mode: ColumnDragWidthMorphMode
  sourceWidth: number
  targetWidth: number
  progress: number
}

export function getOverlayMorphWidth({
  mode,
  sourceWidth,
  targetWidth,
  progress,
}: GetOverlayMorphWidthArgs): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)

  switch (mode) {
    case "snap":
      return clampedProgress >= 0.5 ? targetWidth : sourceWidth
    case "interpolate":
      return sourceWidth + (targetWidth - sourceWidth) * clampedProgress
    case "none":
    default:
      return sourceWidth
  }
}
