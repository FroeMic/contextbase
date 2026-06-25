import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog"
import { useDatatableColumns } from "../../core/DatatableProvider"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type {
  BooleanFilterPayload,
  FilterPayload,
  IdListFilterPayload,
  NumberFilterPayload,
  TextFilterPayload,
  TextListFilterPayload,
} from "../../types/filter.types"
import { BooleanFilterEditor } from "./editors/BooleanFilterEditor"
import { IdListFilterEditor } from "./editors/IdListFilterEditor"
import { NumberFilterEditor } from "./editors/NumberFilterEditor"
import { TextFilterEditor } from "./editors/TextFilterEditor"
import { TextListFilterEditor } from "./editors/TextListFilterEditor"
import { DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME } from "./filter-dialog-layout"

interface FilterEditorModalProps {
  columnId: string | null
  open: boolean
  onClose: () => void
}

/**
 * Modal wrapper for filter editors
 *
 * Routes to the appropriate editor based on column.filterType.
 * Built-in editors:
 * - text: TextFilterEditor
 * - text-list: TextListFilterEditor
 * - number: NumberFilterEditor
 * - boolean: BooleanFilterEditor
 * - id-list: IdListFilterEditor
 */
export const FilterEditorModal = ({ columnId, open, onClose }: FilterEditorModalProps) => {
  const columns = useDatatableColumns()
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const setColumnFilter = useDatatableStore((s) => s.setColumnFilter)

  if (!columnId || !open) {
    return null
  }

  const column = columns.find((col) => col.id === columnId)
  if (!column) {
    return null
  }

  const currentFilter = columnFilters.find((f) => f.id === columnId)

  const handleChange = (payload: FilterPayload | null) => {
    if (!column.filterType) {
      console.error(`Column ${columnId} has no filterType defined`)
      return
    }
    setColumnFilter(columnId, column.filterType, payload)

    // Don't auto-close for text-list filters (multi-select checkboxes)
    // User can close manually or click outside
    if (column.filterType !== "text-list") {
      onClose()
    }
  }

  // Stop keyboard events from bubbling out of modal to prevent them from reaching table header
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  // Route to appropriate editor based on filterType
  const renderEditor = () => {
    switch (column.filterType) {
      case "text":
        return (
          <TextFilterEditor
            columnName={column.header}
            value={currentFilter?.payload as TextFilterPayload | null}
            onChange={handleChange}
            onClose={onClose}
          />
        )

      case "text-list":
        return (
          <TextListFilterEditor
            column={column}
            value={currentFilter?.payload as TextListFilterPayload | null}
            onChange={handleChange}
          />
        )

      case "number":
        return (
          <NumberFilterEditor
            columnName={column.header}
            value={currentFilter?.payload as NumberFilterPayload | null}
            onChange={handleChange}
            onClose={onClose}
          />
        )

      case "boolean":
        return (
          <BooleanFilterEditor
            column={column}
            value={currentFilter?.payload as BooleanFilterPayload | null}
            onChange={handleChange}
          />
        )

      case "id-list":
        return (
          <IdListFilterEditor
            column={column}
            value={currentFilter?.payload as IdListFilterPayload | null}
            onChange={handleChange}
          />
        )

      case "date":
      case "custom":
        return (
          <div className="text-muted-foreground p-4 text-center">
            Filter editor for {column.filterType} is not available in this modal.
          </div>
        )

      default:
        return <div className="text-muted-foreground p-4 text-center">Unknown filter type</div>
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={`${DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME} sm:max-w-md`}
        onKeyDown={handleKeyDown}
      >
        {/* Screen-reader only accessibility labels */}
        <DialogTitle className="sr-only">Filter {column.header}</DialogTitle>
        <DialogDescription className="sr-only">
          Configure filter settings for the {column.header} column
        </DialogDescription>

        {renderEditor()}
      </DialogContent>
    </Dialog>
  )
}
