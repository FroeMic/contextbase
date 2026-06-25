import { createContext, type ReactNode, useContext } from "react"

export type DatatableMobileSelectorRequest<TItem = unknown> = {
  emptyText: string
  filterFn?: (item: TItem, search: string) => boolean
  getItemKey: (item: TItem) => string
  items: readonly TItem[]
  onDismiss?: () => void
  onSelect: (item: TItem) => void
  renderItem: (item: TItem, isSelected: boolean) => ReactNode
  searchPlaceholder: string
  title: ReactNode
}

type DatatableMobileSelectorController = {
  openSelector: (request: DatatableMobileSelectorRequest) => void
}

const DatatableMobileSelectorContext = createContext<DatatableMobileSelectorController | null>(null)

export function DatatableMobileSelectorProvider({
  children,
  openSelector,
}: {
  children: ReactNode
  openSelector: (request: DatatableMobileSelectorRequest) => void
}) {
  return (
    <DatatableMobileSelectorContext.Provider value={{ openSelector }}>
      {children}
    </DatatableMobileSelectorContext.Provider>
  )
}

export function useDatatableMobileSelector() {
  return useContext(DatatableMobileSelectorContext)
}
