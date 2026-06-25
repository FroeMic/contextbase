import type { ColumnResizeSession } from "../../core/ColumnResizeSessionContext"

export function shouldCleanupResizeSession(
  activeResizeSession: ColumnResizeSession | null,
  columnId: string,
) {
  return activeResizeSession?.columnId === columnId
}
