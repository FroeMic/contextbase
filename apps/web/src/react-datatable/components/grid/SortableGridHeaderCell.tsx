import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { memo } from "react"
import { GridHeaderCell, type GridHeaderCellProps } from "./GridHeaderCell"

export interface SortableGridHeaderCellProps<TData>
  extends Omit<
    GridHeaderCellProps<TData>,
    "dragHandleListeners" | "rootRef" | "rootAttributes" | "isDragging" | "transform" | "transition"
  > {
  suppressSortableTransform?: boolean
}

export const SortableGridHeaderCell = memo(function SortableGridHeaderCell<TData>({
  suppressSortableTransform = false,
  ...props
}: SortableGridHeaderCellProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.header.column.id,
  })
  const dndKitTransform = suppressSortableTransform ? "" : CSS.Translate.toString(transform) || ""

  return (
    <GridHeaderCell
      {...props}
      rootRef={setNodeRef}
      rootAttributes={attributes as unknown as Record<string, unknown>}
      dragHandleListeners={listeners}
      isDragging={isDragging}
      transform={dndKitTransform}
      transition={transform && !suppressSortableTransform ? transition : undefined}
    />
  )
}) as <TData>(props: SortableGridHeaderCellProps<TData>) => React.JSX.Element
