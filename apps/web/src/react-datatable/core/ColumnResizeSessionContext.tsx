import { createContext, useContext } from "react"

export interface ColumnResizeSession {
  columnId: string
  startClientX: number
  startWidth: number
  previewWidth: number
  minWidth: number
  maxWidth: number
}

export interface ColumnResizeSessionContextValue {
  activeResizeSession: ColumnResizeSession | null
  setActiveResizeSession: React.Dispatch<React.SetStateAction<ColumnResizeSession | null>>
}

export const ColumnResizeSessionContext = createContext<ColumnResizeSessionContextValue | null>(
  null,
)

export function useDatatableResizeSession() {
  const context = useContext(ColumnResizeSessionContext)

  if (!context) {
    throw new Error("useDatatableResizeSession must be used within DatatableBody")
  }

  return context
}
