import type { ExpandedState } from "@tanstack/react-table"
import type { OnlineGroupingSummary } from "../../types/props.types"
import type { RenderableRow } from "../../types/renderable-row.types"

export const ALL_GROUPS_EXPANDED_MARKER = "*"
const COLLAPSED_GROUP_PREFIX = "!"

export interface OnlineGroupExpansionInput {
  defaultExpanded: boolean
  overrides: Record<string, boolean>
}

export function serializeExpandedStateForOnlineQuery(
  expandedState: ExpandedState,
): OnlineGroupExpansionInput {
  if (expandedState === true) {
    return {
      defaultExpanded: true,
      overrides: {},
    }
  }

  return {
    defaultExpanded: true,
    overrides: Object.fromEntries(
      Object.entries(expandedState).sort(([left], [right]) => left.localeCompare(right)),
    ),
  }
}

export function expandedStateToSet(expandedState: ExpandedState): Set<string> {
  if (expandedState === true) {
    return new Set([ALL_GROUPS_EXPANDED_MARKER])
  }

  const expandedGroups = new Set<string>([ALL_GROUPS_EXPANDED_MARKER])

  for (const [groupId, isExpanded] of Object.entries(expandedState)) {
    if (isExpanded) {
      expandedGroups.delete(`${COLLAPSED_GROUP_PREFIX}${groupId}`)
      continue
    }

    expandedGroups.add(`${COLLAPSED_GROUP_PREFIX}${groupId}`)
  }

  return expandedGroups
}

export function isGroupExpanded(expandedGroups: Set<string>, groupId: string): boolean {
  if (expandedGroups.has(ALL_GROUPS_EXPANDED_MARKER)) {
    return !expandedGroups.has(`${COLLAPSED_GROUP_PREFIX}${groupId}`)
  }

  return expandedGroups.has(groupId)
}

export function applyGroupExpansionToRenderableRows<TData>(
  rows: RenderableRow<TData>[],
  expandedState: ExpandedState,
): RenderableRow<TData>[] {
  const expandedGroups = expandedStateToSet(expandedState)
  const visibleRows: RenderableRow<TData>[] = []
  let hiddenByDepth: number | null = null

  for (const row of rows) {
    if (row.type === "group-header") {
      if (hiddenByDepth !== null && row.depth > hiddenByDepth) {
        continue
      }

      if (hiddenByDepth !== null && row.depth <= hiddenByDepth) {
        hiddenByDepth = null
      }

      const isExpanded = isGroupExpanded(expandedGroups, row.groupId)
      visibleRows.push({
        ...row,
        isExpanded,
      })

      if (!isExpanded) {
        hiddenByDepth = row.depth
      }

      continue
    }

    if (hiddenByDepth !== null) {
      continue
    }

    visibleRows.push(row)
  }

  return visibleRows
}

export interface VisibleGroupedCounts {
  totalDataRows: number
  totalGroupHeaderRows: number
  totalRenderedRows: number
}

export function calculateVisibleGroupedCounts(
  groupingSummary: OnlineGroupingSummary | undefined,
  expandedState: ExpandedState,
): VisibleGroupedCounts | null {
  if (!groupingSummary) {
    return null
  }

  const expandedGroups = expandedStateToSet(expandedState)
  let totalDataRows = 0
  let totalGroupHeaderRows = 0

  for (const [groupId, group] of Object.entries(groupingSummary.groups)) {
    totalGroupHeaderRows += 1

    if (!isGroupExpanded(expandedGroups, groupId)) {
      continue
    }

    const subgroupEntries = Object.entries(group.subgroups ?? {})
    if (subgroupEntries.length === 0) {
      totalDataRows += group.total
      continue
    }

    for (const [subgroupId, subgroup] of subgroupEntries) {
      totalGroupHeaderRows += 1

      if (isGroupExpanded(expandedGroups, subgroupId)) {
        totalDataRows += subgroup.total
      }
    }
  }

  return {
    totalDataRows,
    totalGroupHeaderRows,
    totalRenderedRows: totalDataRows + totalGroupHeaderRows,
  }
}
