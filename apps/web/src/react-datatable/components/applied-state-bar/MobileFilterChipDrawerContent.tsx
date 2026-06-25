import { useMemo } from "react"
import type { DatatableMobileDrawerPageDefinition } from "../mobile/datatable-mobile-drawer-navigation"
import { MobileColumnFilterEditor } from "../../features/filters/MobileColumnFilterEditor"
import type { DatatableColumn } from "../../types/column.types"
import type { ColumnFilter } from "../../types/filter.types"

export type FilterChipDrawerPageId = "root"

export type FilterChipDrawerPageParams = {
  root: Record<string, never>
}

export const FILTER_CHIP_DRAWER_INITIAL_PAGE = "root" satisfies FilterChipDrawerPageId
export const FILTER_CHIP_DRAWER_INITIAL_PARAMS = {} satisfies FilterChipDrawerPageParams["root"]

interface MobileFilterChipDrawerOptions<TData> {
  column?: DatatableColumn<TData>
  filter: ColumnFilter
}

export function useMobileFilterChipDrawerPages<TData>({
  column,
  filter,
}: MobileFilterChipDrawerOptions<TData>) {
  return useMemo(
    () =>
      ({
        root: {
          closeIcon: () => "check",
          description: () => `Configure ${column?.header ?? "column"} filter.`,
          id: "root",
          render: ({ close }) =>
            column ? (
              <div className="p-2">
                <MobileColumnFilterEditor column={column} filter={filter} onClose={close} />
              </div>
            ) : null,
          title: () => column?.meta?.filterName ?? column?.header ?? "Filter",
        },
      }) satisfies Record<
        FilterChipDrawerPageId,
        DatatableMobileDrawerPageDefinition<FilterChipDrawerPageId, FilterChipDrawerPageParams>
      >,
    [column, filter],
  )
}
