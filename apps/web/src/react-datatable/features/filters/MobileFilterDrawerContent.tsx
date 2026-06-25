import { type KeyboardEvent, useCallback, useState } from "react"

import type {
  DatatableMobileDrawerHeaderAction,
  DatatableMobileDrawerPageDefinition,
} from "../../components/mobile/datatable-mobile-drawer-navigation"
import { Input } from "../../components/ui/input"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import type {
  BooleanFilterPayload,
  DateFilterPayload,
  FilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"
import { BooleanFilterEditor } from "./editors/BooleanFilterEditor"
import { CustomDatePickerContent, DateFilterEditor } from "./editors/DateFilterEditor"
import { IdListFilterEditor } from "./editors/IdListFilterEditor"
import { NumberFilterEditor } from "./editors/NumberFilterEditor"
import { TextFilterEditor } from "./editors/TextFilterEditor"
import { TextListFilterEditor } from "./editors/TextListFilterEditor"
import { formatDateFilterSummary } from "./date-filter-utils"
import { FilterItem } from "./FilterItem"
import { useFilterPickerState } from "./use-filter-picker-state"

export type FilterDrawerPageId =
  | "root"
  | "text-list-filter"
  | "date-filter"
  | "custom-date-filter"
  | "editor-filter"

export type FilterDrawerPageParams = {
  "custom-date-filter": { columnId: string }
  "date-filter": { columnId: string }
  "editor-filter": { columnId: string }
  root: Record<string, never>
  "text-list-filter": { columnId: string }
}

export const FILTER_DRAWER_INITIAL_PAGE = "root" satisfies FilterDrawerPageId
export const FILTER_DRAWER_INITIAL_PARAMS = {} satisfies FilterDrawerPageParams["root"]

export const MOBILE_FILTER_DRAWER_PAGES = {
  root: {
    description: () => "Choose a filter to configure.",
    id: "root",
    render: ({ push }) => <MobileFilterRootPage push={push} />,
    title: () => "Filter",
  },
  "text-list-filter": {
    description: ({ columnId }) => `Configure text-list filter ${columnId}.`,
    id: "text-list-filter",
    render: (_context, params) => <MobileTextListFilterPage columnId={params.columnId} />,
    title: ({ columnId }) => <MobileFilterPageTitle columnId={columnId} />,
  },
  "date-filter": {
    description: ({ columnId }) => `Configure date filter ${columnId}.`,
    id: "date-filter",
    render: ({ pop, push }, params) => (
      <MobileDateFilterPage
        columnId={params.columnId}
        onClose={pop}
        onCustomDateRequest={() => push("custom-date-filter", { columnId: params.columnId })}
      />
    ),
    title: ({ columnId }) => <MobileFilterPageTitle columnId={columnId} />,
  },
  "custom-date-filter": {
    closeIcon: () => "check",
    description: ({ columnId }) => `Configure custom date filter ${columnId}.`,
    id: "custom-date-filter",
    render: ({ reset, setHeaderAction }, params) => (
      <MobileCustomDateFilterPage
        columnId={params.columnId}
        onClose={reset}
        setHeaderAction={setHeaderAction}
      />
    ),
    title: () => "Custom date",
  },
  "editor-filter": {
    description: ({ columnId }) => `Configure filter ${columnId}.`,
    id: "editor-filter",
    render: ({ pop, setHeaderAction }, params) => (
      <MobileGenericFilterPage
        columnId={params.columnId}
        onClose={pop}
        setHeaderAction={setHeaderAction}
      />
    ),
    title: ({ columnId }) => <MobileFilterPageTitle columnId={columnId} />,
  },
} satisfies Record<
  FilterDrawerPageId,
  DatatableMobileDrawerPageDefinition<FilterDrawerPageId, FilterDrawerPageParams>
>

function MobileFilterRootPage({
  push,
}: {
  push: <TNextPageId extends FilterDrawerPageId>(
    pageId: TNextPageId,
    params: FilterDrawerPageParams[TNextPageId],
  ) => void
}) {
  const { filteredColumns, search, setSearch } = useFilterPickerState()
  const [selectedIndex, setSelectedIndex] = useState(0)

  function openColumn(column: (typeof filteredColumns)[number]) {
    if (column.filterType === "text-list") {
      push("text-list-filter", { columnId: column.id })
      return
    }
    if (column.filterType === "date") {
      push("date-filter", { columnId: column.id })
      return
    }
    push("editor-filter", { columnId: column.id })
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (filteredColumns.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedIndex((current) => (current + 1) % filteredColumns.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedIndex((current) => (current - 1 + filteredColumns.length) % filteredColumns.length)
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const selectedColumn = filteredColumns[selectedIndex]
      if (selectedColumn) openColumn(selectedColumn)
    }
  }

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={handleKeyDown} role="menu">
      <div className="sticky top-0 z-10 bg-popover p-2">
        <Input
          aria-label="Search filter columns"
          className={DATATABLE_MOBILE_SEARCH_INPUT_CLASS}
          onChange={(event) => {
            setSearch(event.target.value)
            setSelectedIndex(0)
          }}
          placeholder="Search filters..."
          value={search}
        />
      </div>
      <div className="min-h-0 overflow-y-auto p-2">
        {filteredColumns.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No filters found
          </div>
        ) : (
          filteredColumns.map((column, index) => (
            <FilterItem
              column={column}
              isSelected={index === selectedIndex}
              key={column.id}
              onSelect={() => openColumn(column)}
              variant="mobile"
            />
          ))
        )}
      </div>
    </div>
  )
}

function MobileTextListFilterPage({ columnId }: { columnId: string }) {
  const { columnFilters, filterableColumns, setColumnFilter } = useFilterPickerState()
  const column = filterableColumns.find((candidate) => candidate.id === columnId)
  if (!column) return null

  const currentPayload = columnFilters.find((filter) => filter.id === column.id)?.payload as
    | TextListFilterPayload
    | undefined

  return (
    <div className="p-2">
      <TextListFilterEditor
        column={column}
        onChange={(payload) => setColumnFilter(column.id, "text-list", payload)}
        value={currentPayload ?? null}
        variant="mobile"
      />
    </div>
  )
}

function MobileDateFilterPage({
  columnId,
  onClose,
  onCustomDateRequest,
}: {
  columnId: string
  onClose: () => void
  onCustomDateRequest: () => void
}) {
  const { columnFilters, filterableColumns, setColumnFilter } = useFilterPickerState()
  const column = filterableColumns.find((candidate) => candidate.id === columnId)
  if (!column) return null

  const currentPayload = columnFilters.find((filter) => filter.id === column.id)?.payload as
    | DateFilterPayload
    | undefined

  return (
    <div className="p-2">
      {currentPayload ? (
        <div className="mx-1 mb-2 rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Current filter</div>
          <div className="mt-0.5 text-sm text-foreground">
            {formatDateFilterSummary(currentPayload)}
          </div>
        </div>
      ) : null}
      <DateFilterEditor
        column={column}
        onChange={(payload) => setColumnFilter(column.id, "date", payload)}
        onClose={onClose}
        onCustomDateRequest={onCustomDateRequest}
        value={currentPayload ?? null}
        variant="mobile"
      />
    </div>
  )
}

function MobileCustomDateFilterPage({
  columnId,
  onClose,
  setHeaderAction,
}: {
  columnId: string
  onClose: () => void
  setHeaderAction: (action: DatatableMobileDrawerHeaderAction | null) => void
}) {
  const { columnFilters, filterableColumns, setColumnFilter } = useFilterPickerState()
  const column = filterableColumns.find((candidate) => candidate.id === columnId)
  if (!column) return null

  const currentPayload = columnFilters.find((filter) => filter.id === column.id)?.payload as
    | DateFilterPayload
    | undefined
  const handleChange = useCallback(
    (payload: DateFilterPayload | null) => setColumnFilter(column.id, "date", payload),
    [column.id, setColumnFilter],
  )

  return (
    <CustomDatePickerContent
      columnHeader={column.header}
      onCancel={onClose}
      onChange={handleChange}
      onClose={onClose}
      onMobileHeaderActionChange={setHeaderAction}
      value={currentPayload ?? null}
      variant="mobile"
    />
  )
}

function MobileGenericFilterPage({
  columnId,
  onClose,
  setHeaderAction,
}: {
  columnId: string
  onClose: () => void
  setHeaderAction: (action: DatatableMobileDrawerHeaderAction | null) => void
}) {
  const { columnFilters, filterableColumns, setColumnFilter } = useFilterPickerState()
  const column = filterableColumns.find((candidate) => candidate.id === columnId)
  if (!column) return null

  const currentFilter = columnFilters.find((filter) => filter.id === column.id)

  const handleChange = useCallback(
    (payload: FilterPayload | null) => {
      if (!column?.filterType) return

      setColumnFilter(column.id, column.filterType, payload)

      if (column.filterType !== "boolean" && column.filterType !== "id-list") {
        onClose()
      }
    },
    [column?.filterType, column.id, onClose, setColumnFilter],
  )

  return (
    <div className="p-2">
      {column.filterType === "text" ? (
        <TextFilterEditor
          columnName={column.header}
          onChange={handleChange}
          onClose={onClose}
          onMobileHeaderActionChange={setHeaderAction}
          value={currentFilter?.payload as TextFilterPayload | null}
          variant="mobile"
        />
      ) : column.filterType === "number" ? (
        <NumberFilterEditor
          columnName={column.header}
          onChange={handleChange}
          onClose={onClose}
          value={currentFilter?.payload as NumberFilterPayload | null}
          variant="mobile"
        />
      ) : column.filterType === "boolean" ? (
        <BooleanFilterEditor
          column={column}
          onChange={handleChange}
          value={currentFilter?.payload as BooleanFilterPayload | null}
          variant="mobile"
        />
      ) : column.filterType === "id-list" ? (
        <IdListFilterEditor
          column={column}
          onChange={handleChange}
          value={currentFilter?.payload as IdListFilterPayload | null}
          variant="mobile"
        />
      ) : (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          This filter type is not available.
        </div>
      )}
    </div>
  )
}

function MobileFilterPageTitle({ columnId }: { columnId: string }) {
  const { filterableColumns } = useFilterPickerState()
  const column = filterableColumns.find((candidate) => candidate.id === columnId)
  return column?.meta?.filterName ?? column?.header ?? "Filter"
}
