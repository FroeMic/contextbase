import type { RowData, Table } from "@tanstack/react-table"
import { type CSSProperties, memo } from "react"
import { CollapseChevron } from "../../../shared/ui/collapse-chevron"
import { Z_INDEX } from "../../core/layout/constants"
import { resolveGroupRowPresentation } from "../../core/row-model/row-presentation"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore, useDatatableStoreApi } from "../../state/store/use-datatable-store"
import type { DatatableRowPresentationConfig } from "../../types/props.types"
import type { RenderableGroupHeader } from "../../types/renderable-row.types"

type GridGroupHeaderPane = "single" | "frozen" | "scrollable"

interface GridGroupHeaderProps<TData extends RowData> {
  header: RenderableGroupHeader
  table: Table<TData>
  y: number
  width: number
  height: number
  pane?: GridGroupHeaderPane
  contentWidth: number
  contentOffsetX: number
  isExpandable?: boolean
  isActive?: boolean
  onActivate?: () => void
  rowPresentation?: DatatableRowPresentationConfig<TData>
}

const buttonBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  borderRadius: "4px",
  transition: "background-color 150ms",
  border: "none",
  background: "transparent",
  padding: 0,
}

const activeGroupRowFill = "var(--muted)"
const inactivePrimaryGroupFill = "color-mix(in oklch, var(--muted) 48%, var(--background))"
const activeSubgroupFill = "var(--muted)"

function getAnchorStyle(pane: GridGroupHeaderPane, width: number, height: number): CSSProperties {
  return {
    position: pane === "single" || pane === "scrollable" ? "sticky" : "relative",
    left: 0,
    width,
    height,
  }
}

function getTranslatedContentStyle(
  contentWidth: number,
  contentOffsetX: number,
  height: number,
): CSSProperties {
  return {
    width: contentWidth,
    height,
    transform: contentOffsetX === 0 ? undefined : `translateX(-${contentOffsetX}px)`,
  }
}

function renderIndicator(isExpanded: boolean) {
  return <CollapseChevron className="size-3.5" isOpen={isExpanded} />
}

/**
 * Grid mode group header component
 *
 * Supports three pane modes:
 * - `single`: inline full-width row when there are no frozen columns
 * - `frozen`: semantic fragment for the frozen pane
 * - `scrollable`: visual continuation fragment for the scrollable pane
 */
export const GridGroupHeader = memo(function GridGroupHeader<TData extends RowData>({
  header,
  table,
  y,
  width,
  height,
  pane = "single",
  contentWidth,
  contentOffsetX,
  isExpandable = true,
  isActive = false,
  onActivate,
  rowPresentation,
}: GridGroupHeaderProps<TData>) {
  const store = useDatatableStoreApi()
  const setGroupExpanded = useDatatableStore((s) => s.setGroupExpanded)

  const { groupId, columnId, value, depth, count, isExpanded } = header
  const column = table.getColumn(columnId)
  const customRenderer = column?.columnDef?.meta?.renderRowGroupHeader

  const isSemanticPane = pane !== "scrollable"

  const handleToggle = () => {
    if (!isExpandable) {
      return
    }

    const currentState = store.getState().groupExpanded
    if (currentState === true) {
      setGroupExpanded({ [groupId]: false })
      return
    }

    const nextState = { ...currentState }
    nextState[groupId] = !isExpanded
    setGroupExpanded(nextState)
  }

  const rootStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: y,
    width,
    height,
    overflow: "hidden",
    zIndex: Z_INDEX.GRID.FULL_WIDTH_ROWS,
    backgroundColor: "var(--background)",
    pointerEvents: "none",
  }

  const anchorStyle = getAnchorStyle(pane, width, height)
  const translatedContentStyle = getTranslatedContentStyle(contentWidth, contentOffsetX, height)
  const presentation = resolveGroupRowPresentation({
    rowPresentation,
    groupHeader: header,
    isActive,
  })

  if (customRenderer) {
    const content = isSemanticPane
      ? customRenderer({
          groupId,
          columnId,
          groupValue: value,
          count,
          depth,
          isExpanded,
          isActive,
          isExpandable,
          toggle: handleToggle,
        })
      : null

    return (
      <div
        role={isSemanticPane ? "row" : undefined}
        aria-hidden={isSemanticPane ? undefined : true}
        data-active={isSemanticPane && isActive ? true : undefined}
        className={cn("rounded-sm", presentation.className)}
        {...presentation.attributes}
        style={{
          ...rootStyle,
          backgroundColor: isActive
            ? activeGroupRowFill
            : depth === 0
              ? inactivePrimaryGroupFill
              : "transparent",
        }}
      >
        <div style={anchorStyle}>
          <div style={translatedContentStyle}>
            <div
              style={{
                height,
                display: "flex",
                alignItems: "center",
                pointerEvents: isSemanticPane ? "auto" : "none",
              }}
            >
              {content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const indicator = renderIndicator(isExpanded)

  if (depth === 0) {
    return (
      <div
        role={isSemanticPane ? "row" : undefined}
        aria-hidden={isSemanticPane ? undefined : true}
        data-active={isSemanticPane && isActive ? true : undefined}
        className={cn("rounded-sm", presentation.className)}
        {...presentation.attributes}
        style={{
          ...rootStyle,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: isActive ? activeGroupRowFill : inactivePrimaryGroupFill,
            borderRadius: "0.125rem",
            zIndex: -1,
          }}
        />

        <div style={anchorStyle}>
          <div style={translatedContentStyle}>
            <div
              style={{
                height,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0 12px",
                width: "100%",
                backgroundColor: isActive ? activeGroupRowFill : undefined,
                pointerEvents: isSemanticPane ? "auto" : "none",
              }}
              onClick={isSemanticPane ? onActivate : undefined}
            >
              {isSemanticPane ? (
                <button
                  onClick={handleToggle}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} group ${value} with ${count} items`}
                  disabled={!isExpandable}
                  type="button"
                  style={{
                    ...buttonBaseStyle,
                    cursor: isExpandable ? "pointer" : "default",
                    opacity: isExpandable ? 1 : 0.6,
                    pointerEvents: "auto",
                  }}
                  onMouseEnter={(event) => {
                    if (!isExpandable) {
                      return
                    }

                    event.currentTarget.style.backgroundColor = "var(--accent)"
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent"
                  }}
                >
                  {indicator}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    ...buttonBaseStyle,
                    opacity: 0.6,
                  }}
                >
                  {indicator}
                </span>
              )}

              <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{String(value)}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{count}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role={isSemanticPane ? "row" : undefined}
      aria-hidden={isSemanticPane ? undefined : true}
      data-active={isSemanticPane && isActive ? true : undefined}
      className={cn("rounded-sm", presentation.className)}
      {...presentation.attributes}
      style={{
        ...rootStyle,
        backgroundColor: isActive ? activeSubgroupFill : rootStyle.backgroundColor,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: pane === "scrollable" ? 0 : "12px",
          right: 0,
          height: "1px",
          backgroundColor: "var(--border)",
          transform: "translateY(-50%)",
        }}
      />

      <div style={anchorStyle}>
        <div style={translatedContentStyle}>
          <div
            style={{
              height,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "fit-content",
              backgroundColor: isActive ? activeSubgroupFill : "var(--background)",
              padding: "0 8px 0 24px",
              pointerEvents: isSemanticPane ? "auto" : "none",
            }}
            onClick={isSemanticPane ? onActivate : undefined}
          >
            {isSemanticPane ? (
              <button
                onClick={handleToggle}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} subgroup ${value} with ${count} items`}
                disabled={!isExpandable}
                type="button"
                style={{
                  ...buttonBaseStyle,
                  cursor: isExpandable ? "pointer" : "default",
                  opacity: isExpandable ? 1 : 0.6,
                  pointerEvents: "auto",
                }}
                onMouseEnter={(event) => {
                  if (!isExpandable) {
                    return
                  }

                  event.currentTarget.style.backgroundColor = "var(--accent)"
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                {indicator}
              </button>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  ...buttonBaseStyle,
                  opacity: 0.6,
                }}
              >
                {indicator}
              </span>
            )}

            <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{String(value)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{count}</span>
          </div>
        </div>
      </div>
    </div>
  )
}) as <TData extends RowData>(props: GridGroupHeaderProps<TData>) => React.JSX.Element
