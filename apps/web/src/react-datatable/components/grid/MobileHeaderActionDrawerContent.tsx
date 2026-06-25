import { type ReactNode, useMemo, useState } from "react"
import type { DatatableMobileDrawerPageDefinition } from "../mobile/datatable-mobile-drawer-navigation"
import {
  CheckIcon,
  ChevronRightIcon,
  EyeSlashIcon,
  FunnelIcon,
  RulerIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  XIcon,
} from "../ui/icons"
import {
  COLUMN_WIDTH_DEFAULTS,
  getColumnMaxWidth,
  getColumnMinWidth,
} from "../../core/column-sizing/column-width"
import { MobileColumnFilterEditor } from "../../features/filters/MobileColumnFilterEditor"
import { DATATABLE_MOBILE_SEARCH_INPUT_CLASS } from "../../shared/styles/input-classes"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableColumn } from "../../types/column.types"
import type { ColumnFilter } from "../../types/filter.types"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

export type HeaderActionDrawerPageId = "root" | "filter" | "resize"

export type HeaderActionDrawerPageParams = {
  filter: Record<string, never>
  resize: Record<string, never>
  root: Record<string, never>
}

export const HEADER_ACTION_DRAWER_INITIAL_PAGE = "root" satisfies HeaderActionDrawerPageId
export const HEADER_ACTION_DRAWER_INITIAL_PARAMS = {} satisfies HeaderActionDrawerPageParams["root"]

interface MobileHeaderActionDrawerOptions<TData> {
  canFilter: boolean
  canHide: boolean
  canResize: boolean
  canSort: boolean
  column: DatatableColumn<TData> | undefined
  currentFilter?: ColumnFilter
  currentSort?: { id: string; desc: boolean }
  currentWidth: number
  hasActiveFilter: boolean
  onApplyWidth: (width: number) => void
  onHide: () => void
  onRemoveFilter: () => void
  onResetWidth: () => void
  onSort: (desc: boolean) => void
  sortLabels: { asc: string; desc: string }
}

export function useMobileHeaderActionDrawerPages<TData>(
  options: MobileHeaderActionDrawerOptions<TData>,
) {
  return useMemo(
    () =>
      ({
        root: {
          closeIcon: () => "check",
          description: () => `Configure ${options.column?.header ?? "column"} actions.`,
          id: "root",
          render: ({ close, push }) => (
            <MobileHeaderActionRootPage close={close} options={options} push={push} />
          ),
          title: () => options.column?.header ?? "Column",
        },
        filter: {
          closeIcon: () => "check",
          description: () => `Configure ${options.column?.header ?? "column"} filter.`,
          id: "filter",
          render: ({ close }) => <MobileHeaderFilterPage close={close} options={options} />,
          title: () => options.column?.meta?.filterName ?? options.column?.header ?? "Filter",
        },
        resize: {
          closeIcon: () => "check",
          description: () => `Resize ${options.column?.header ?? "column"}.`,
          id: "resize",
          render: ({ close }) => <MobileHeaderResizePage close={close} options={options} />,
          title: () => "Resize",
        },
      }) satisfies Record<
        HeaderActionDrawerPageId,
        DatatableMobileDrawerPageDefinition<HeaderActionDrawerPageId, HeaderActionDrawerPageParams>
      >,
    [options],
  )
}

function MobileHeaderActionRootPage<TData>({
  close,
  options,
  push,
}: {
  close: () => void
  options: MobileHeaderActionDrawerOptions<TData>
  push: <TNextPageId extends HeaderActionDrawerPageId>(
    pageId: TNextPageId,
    params: HeaderActionDrawerPageParams[TNextPageId],
  ) => void
}) {
  const clearColumnSorting = useDatatableStore((s) => s.setSorting)
  const sorting = useDatatableStore((s) => s.sorting)

  const runAndClose = (action: () => void) => {
    action()
    close()
  }

  return (
    <div className="min-h-0 overflow-y-auto p-2">
      <div className="space-y-1">
        {options.canResize ? (
          <MobileActionRow
            icon={<RulerIcon className="size-5" />}
            onClick={() => push("resize", {})}
            trailing={<ChevronRightIcon className="size-4" />}
          >
            Resize...
          </MobileActionRow>
        ) : null}
        {options.canFilter && options.column ? (
          <MobileActionRow
            icon={<FunnelIcon className="size-5" />}
            onClick={() => push("filter", {})}
            trailing={<ChevronRightIcon className="size-4" />}
          >
            Filter
          </MobileActionRow>
        ) : null}
        {options.hasActiveFilter ? (
          <MobileActionRow
            icon={<XIcon className="size-5" />}
            onClick={() => runAndClose(options.onRemoveFilter)}
          >
            Remove Filter
          </MobileActionRow>
        ) : null}
        {options.canHide ? (
          <MobileActionRow
            icon={<EyeSlashIcon className="size-5" />}
            onClick={() => runAndClose(options.onHide)}
          >
            Hide
          </MobileActionRow>
        ) : null}
        {options.canSort ? (
          <>
            <MobileActionRow
              icon={<SortAscendingIcon className="size-5" />}
              onClick={() => runAndClose(() => options.onSort(false))}
              trailing={!options.currentSort?.desc ? <CheckIcon className="size-4" /> : null}
            >
              {options.sortLabels.asc}
            </MobileActionRow>
            <MobileActionRow
              icon={<SortDescendingIcon className="size-5" />}
              onClick={() => runAndClose(() => options.onSort(true))}
              trailing={options.currentSort?.desc ? <CheckIcon className="size-4" /> : null}
            >
              {options.sortLabels.desc}
            </MobileActionRow>
            {options.currentSort ? (
              <MobileActionRow
                icon={<XIcon className="size-5" />}
                onClick={() =>
                  runAndClose(() =>
                    clearColumnSorting(
                      sorting.filter((sort) => sort.id !== options.currentSort?.id),
                    ),
                  )
                }
              >
                Remove Sorting
              </MobileActionRow>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function MobileHeaderFilterPage<TData>({
  close,
  options,
}: {
  close: () => void
  options: MobileHeaderActionDrawerOptions<TData>
}) {
  if (!options.column) return null

  return (
    <div className="min-h-0 overflow-y-auto p-2">
      <MobileColumnFilterEditor
        column={options.column}
        filter={options.currentFilter}
        onClose={close}
      />
    </div>
  )
}

function MobileHeaderResizePage<TData>({
  close,
  options,
}: {
  close: () => void
  options: MobileHeaderActionDrawerOptions<TData>
}) {
  if (!options.column) return null

  return (
    <div className="min-h-0 overflow-y-auto p-4">
      <MobileColumnResizeEditor
        column={options.column}
        currentWidth={options.currentWidth}
        onApply={(width) => {
          options.onApplyWidth(width)
          close()
        }}
        onReset={() => {
          options.onResetWidth()
          close()
        }}
      />
    </div>
  )
}

function MobileColumnResizeEditor<TData>({
  column,
  currentWidth,
  onApply,
  onReset,
}: {
  column: DatatableColumn<TData>
  currentWidth: number
  onApply: (width: number) => void
  onReset: () => void
}) {
  const minWidth = getColumnMinWidth(column)
  const maxWidth = getColumnMaxWidth(column)
  const defaultWidth = column.width ?? COLUMN_WIDTH_DEFAULTS.DEFAULT
  const [inputValue, setInputValue] = useState(String(currentWidth))
  const parsedWidth = Number.parseInt(inputValue, 10)
  const error =
    inputValue === "" || Number.isNaN(parsedWidth)
      ? "Please enter a valid number"
      : parsedWidth < minWidth
        ? `Minimum width is ${minWidth}px`
        : parsedWidth > maxWidth
          ? `Maximum width is ${maxWidth}px`
          : null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium" htmlFor={`mobile-column-width-${column.id}`}>
          Width (px)
        </Label>
        <Input
          className={DATATABLE_MOBILE_SEARCH_INPUT_CLASS}
          id={`mobile-column-width-${column.id}`}
          inputMode="numeric"
          max={maxWidth}
          min={minWidth}
          onChange={(event) => setInputValue(event.target.value)}
          type="number"
          value={inputValue}
        />
        <p className="min-h-5 text-sm text-destructive">{error}</p>
      </div>

      <div className="text-sm text-muted-foreground">
        Range: {minWidth} - {maxWidth} px. Default: {defaultWidth}px.
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button className="h-10 rounded-full px-4 text-sm" onClick={onReset} variant="ghost">
          Reset
        </Button>
        <Button
          className="h-10 rounded-full px-5 text-sm"
          disabled={!!error}
          onClick={() => onApply(parsedWidth)}
        >
          Apply
        </Button>
      </div>
    </div>
  )
}

function MobileActionRow({
  children,
  icon,
  onClick,
  trailing,
}: {
  children: ReactNode
  icon: ReactNode
  onClick: () => void
  trailing?: ReactNode
}) {
  return (
    <button
      className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
      type="button"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="text-muted-foreground">{trailing}</span> : null}
    </button>
  )
}
