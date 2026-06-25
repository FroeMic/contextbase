import { BooleanFilterEditor } from "./editors/BooleanFilterEditor"
import { DateFilterEditor } from "./editors/DateFilterEditor"
import { IdListFilterEditor } from "./editors/IdListFilterEditor"
import { NumberFilterEditor } from "./editors/NumberFilterEditor"
import { TextFilterEditor } from "./editors/TextFilterEditor"
import { TextListFilterEditor } from "./editors/TextListFilterEditor"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type {
  BooleanFilterPayload,
  ColumnFilter,
  DateFilterPayload,
  FilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"

interface MobileColumnFilterEditorProps<TData> {
  column: DatatableColumn<TData>
  filter?: ColumnFilter
  onClose: () => void
}

export function MobileColumnFilterEditor<TData>({
  column,
  filter,
  onClose,
}: MobileColumnFilterEditorProps<TData>) {
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)
  const removeColumnFilter = useDatatableStore((s) => s.removeColumnFilter)

  function updateFilter(
    type: NonNullable<DatatableColumn<TData>["filterType"]>,
    payload: FilterPayload | null,
  ) {
    if (payload === null) {
      removeColumnFilter(column.id)
      return
    }

    setColumnFilter(column.id, type, payload)
  }

  if (column.filterType === "text-list") {
    return (
      <TextListFilterEditor
        column={column}
        onChange={(payload) => updateFilter("text-list", payload)}
        value={(filter?.payload as TextListFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  if (column.filterType === "date") {
    return (
      <DateFilterEditor
        column={column}
        onChange={(payload) => updateFilter("date", payload)}
        onClose={onClose}
        value={(filter?.payload as DateFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  if (column.filterType === "text") {
    return (
      <TextFilterEditor
        columnName={column.header}
        onChange={(payload) => updateFilter("text", payload)}
        onClose={onClose}
        value={(filter?.payload as TextFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  if (column.filterType === "number") {
    return (
      <NumberFilterEditor
        columnName={column.header}
        onChange={(payload) => updateFilter("number", payload)}
        onClose={onClose}
        value={(filter?.payload as NumberFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  if (column.filterType === "boolean") {
    return (
      <BooleanFilterEditor
        column={column}
        onChange={(payload) => updateFilter("boolean", payload)}
        value={(filter?.payload as BooleanFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  if (column.filterType === "id-list") {
    return (
      <IdListFilterEditor
        column={column}
        onChange={(payload) => updateFilter("id-list", payload)}
        value={(filter?.payload as IdListFilterPayload | undefined) ?? null}
        variant="mobile"
      />
    )
  }

  return (
    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
      This filter type is not available.
    </div>
  )
}
