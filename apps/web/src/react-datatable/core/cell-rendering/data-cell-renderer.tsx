import { flexRender, type Table } from "@tanstack/react-table"
import { GridCell } from "../../components/grid/GridCell"
import { GridValueCell } from "../../components/grid/GridValueCell"
import { LoadingGridCell } from "../../components/grid/LoadingGridCell"
import type { CellMatrix } from "../../types/grid.types"
import type { RenderableDataRow } from "../../types/renderable-row.types"
import { createOnlineCellContext, resolveOnlineColumnValue } from "./online-cell-context"

export interface DataCellRenderArgs<TData> {
  row: RenderableDataRow<TData>
  columnId: string
  columnIndex: number
  rowIndex: number
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  isSelected: boolean
  isActive: boolean
  isPreviewOpen: boolean
  className?: string
  interactionAttributes?: Record<string, unknown>
  showVerticalLine: boolean
  showHorizontalLine: boolean
  onClick: React.MouseEventHandler<HTMLDivElement>
}

export interface DataCellRenderer<TData> {
  renderDataCell: (args: DataCellRenderArgs<TData>) => React.ReactElement | null
}

export function createTanStackDataCellRenderer<TData>({
  cellMatrix,
}: {
  cellMatrix: CellMatrix<TData>
}): DataCellRenderer<TData> {
  return {
    renderDataCell: (args) => {
      const cell = cellMatrix.get(`${args.row.rowId}-${args.columnId}`)

      if (!cell) {
        return (
          <LoadingGridCell
            key={`loading-cell-missing-${args.rowIndex}-${args.columnId}`}
            x={args.x}
            y={args.y}
            width={args.width}
            height={args.height}
            zIndex={args.zIndex}
            showVerticalLine={args.showVerticalLine}
            showHorizontalLine={args.showHorizontalLine}
          />
        )
      }

      return (
        <GridCell
          key={`cell-${args.rowIndex}-${args.columnId}`}
          cell={cell}
          x={args.x}
          y={args.y}
          width={args.width}
          height={args.height}
          zIndex={args.zIndex}
          className={args.className}
          columnIndex={args.columnIndex}
          rowIndex={args.rowIndex}
          showVerticalLine={args.showVerticalLine}
          showHorizontalLine={args.showHorizontalLine}
          isSelected={args.isSelected}
          isActive={args.isActive}
          isPreviewOpen={args.isPreviewOpen}
          interactionAttributes={args.interactionAttributes}
          rowId={args.row.rowId}
          onClick={args.onClick}
        />
      )
    },
  }
}

export function createOnlineVirtualDataCellRenderer<TData>({
  table,
}: {
  table: Table<TData>
}): DataCellRenderer<TData> {
  return {
    renderDataCell: (args) => {
      const column = table.getColumn(args.columnId)
      const accessorFn = column?.accessorFn as ((row: TData, index: number) => unknown) | undefined
      const getColumnValue = (columnId: string) => {
        const targetColumn = table.getColumn(columnId)
        return resolveOnlineColumnValue({
          row: args.row.data,
          columnId,
          accessorFn: targetColumn?.accessorFn as
            | ((row: TData, index: number) => unknown)
            | undefined,
        })
      }
      const value = resolveOnlineColumnValue({
        row: args.row.data,
        columnId: args.columnId,
        accessorFn,
      })
      const context = createOnlineCellContext({
        rowId: args.row.rowId,
        row: args.row.data,
        columnId: args.columnId,
        value,
        column,
        table,
        getColumnValue,
      })
      const renderedValue = column?.columnDef.cell
        ? flexRender(column.columnDef.cell, context as never)
        : (value as React.ReactNode)

      return (
        <GridValueCell
          key={`cell-${args.rowIndex}-${args.columnId}`}
          value={renderedValue}
          x={args.x}
          y={args.y}
          width={args.width}
          height={args.height}
          zIndex={args.zIndex}
          className={args.className}
          columnIndex={args.columnIndex}
          rowIndex={args.rowIndex}
          showVerticalLine={args.showVerticalLine}
          showHorizontalLine={args.showHorizontalLine}
          isSelected={args.isSelected}
          isActive={args.isActive}
          isPreviewOpen={args.isPreviewOpen}
          interactionAttributes={args.interactionAttributes}
          rowId={args.row.rowId}
          onClick={args.onClick}
        />
      )
    },
  }
}
