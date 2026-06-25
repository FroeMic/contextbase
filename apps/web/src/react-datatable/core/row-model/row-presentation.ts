import { cn } from "../../shared/utils/cn"
import type { DatatableRowPresentationConfig } from "../../types/props.types"
import type { RenderableGroupHeader } from "../../types/renderable-row.types"

interface ResolveRowPresentationParams<TData> {
  rowPresentation?: DatatableRowPresentationConfig<TData>
  row: TData
  rowId: string
  columnId: string
  isSelected: boolean
  isActive: boolean
  isPreviewOpen: boolean
}

export function resolveRowPresentation<TData>({
  rowPresentation,
  row,
  rowId,
  columnId,
  isSelected,
  isActive,
  isPreviewOpen,
}: ResolveRowPresentationParams<TData>) {
  const rowInfo = {
    rowKind: "data" as const,
    row,
    rowId,
    isSelected,
    isActive,
    isPreviewOpen,
  }

  const cellInfo = {
    ...rowInfo,
    columnId,
  }

  return {
    className:
      cn(
        rowPresentation?.getRowClassName?.(rowInfo),
        rowPresentation?.getCellClassName?.(cellInfo),
      ) || undefined,
    attributes: {
      ...(rowPresentation?.getRowAttributes?.(rowInfo) ?? {}),
      ...(rowPresentation?.getCellAttributes?.(cellInfo) ?? {}),
    },
  }
}

interface ResolveGroupRowPresentationParams<TData> {
  rowPresentation?: DatatableRowPresentationConfig<TData>
  groupHeader: RenderableGroupHeader
  isActive: boolean
}

export function resolveGroupRowPresentation<TData>({
  rowPresentation,
  groupHeader,
  isActive,
}: ResolveGroupRowPresentationParams<TData>) {
  const rowInfo = {
    rowKind: "group-header" as const,
    rowId: groupHeader.groupId,
    groupHeader,
    isSelected: false as const,
    isActive,
    isPreviewOpen: false as const,
  }

  return {
    className: cn(rowPresentation?.getRowClassName?.(rowInfo)) || undefined,
    attributes: {
      ...(rowPresentation?.getRowAttributes?.(rowInfo) ?? {}),
    },
  }
}
