import { isGroupExpanded } from "../../features/grouping/group-expansion"
import type { ResolvedGroupingValue } from "../../features/grouping/grouping-model"
import type {
  GroupingConfig,
  RenderableDataRow,
  RenderableGroupHeader,
  RenderableRow,
} from "../../types/renderable-row.types"

/**
 * Build a flat array of renderable items from data rows
 *
 * This is a PURE FUNCTION - no React, no TanStack coupling.
 * Takes data and configuration, returns a flat list of items to render.
 *
 * Algorithm:
 * 1. Group data by first grouping column
 * 2. Sort group keys using priority: manual order > custom function > alphabetical
 * 3. For each group, create group header
 * 4. If group is expanded and has second-level grouping, recursively group children
 * 5. If group is expanded and no more grouping, add data rows
 * 6. Return flat array: [GroupHeader, DataRow, DataRow, GroupHeader, ...]
 *
 * @param dataRows - Array of { rowId, data } objects from TanStack
 * @param config - Grouping configuration
 * @returns Flat array of renderable items
 */
export function buildRenderableRows<TData>(
  dataRows: Array<{ rowId: string; data: TData }>,
  config: GroupingConfig<TData>,
): RenderableRow<TData>[] {
  // No grouping: return all data rows
  if (config.groupByColumns.length === 0) {
    return dataRows.map((row) => ({
      type: "data" as const,
      rowId: row.rowId,
      data: row.data,
      groupPath: [],
    }))
  }

  // Build grouped structure recursively
  return buildGroupLevel(dataRows, config, 0, [])
}

/**
 * Build one level of grouping
 * @param dataRows - Rows to group at this level
 * @param config - Grouping configuration
 * @param depth - Current grouping depth (0 = first level)
 * @param parentGroupPath - Group IDs of parent groups
 */
function buildGroupLevel<TData>(
  dataRows: Array<{ rowId: string; data: TData }>,
  config: GroupingConfig<TData>,
  depth: number,
  parentGroupPath: string[],
): RenderableRow<TData>[] {
  const columnId = config.groupByColumns[depth]
  if (!columnId) {
    // No more grouping levels: return data rows
    return dataRows.map((row) => ({
      type: "data" as const,
      rowId: row.rowId,
      data: row.data,
      groupPath: parentGroupPath,
    }))
  }

  // Group rows by their grouping value
  const groups = new Map<
    string,
    {
      label: string
      sortValue?: string | number
      rows: Array<{ rowId: string; data: TData }>
    }
  >()

  for (const row of dataRows) {
    const groupValue = config.getGroupValue(columnId, row.data)
    const resolvedValues = normalizeGroupValue(groupValue)

    for (const resolvedValue of resolvedValues) {
      const existingGroup = groups.get(resolvedValue.key)
      if (!existingGroup) {
        groups.set(resolvedValue.key, {
          label: resolvedValue.label,
          sortValue: resolvedValue.sortValue,
          rows: [row],
        })
        continue
      }

      existingGroup.rows.push(row)
    }
  }

  if (config.showEmptyGroups) {
    for (const domainValue of config.getGroupDomain?.(columnId) ?? []) {
      if (!groups.has(domainValue.key)) {
        groups.set(domainValue.key, {
          label: domainValue.label,
          sortValue: domainValue.sortValue,
          rows: [],
        })
      }
    }
  }

  // Sort group keys
  const sortedGroups = sortGroupKeys(
    Array.from(groups.entries()).map(([key, group]) => ({
      key,
      label: group.label,
      sortValue: group.sortValue,
    })),
    columnId,
    config,
  )

  // Build result with group headers and children
  const result: RenderableRow<TData>[] = []

  for (const group of sortedGroups) {
    const groupedRows = groups.get(group.key)
    if (!groupedRows) {
      continue
    }

    const groupRows = groupedRows.rows
    const groupId = buildGroupId(parentGroupPath, columnId, group.key)
    const groupPath = [...parentGroupPath, groupId]

    // Create group header
    // Check if this specific group is expanded OR if all groups are expanded ("*" marker)
    const isExpanded = isGroupExpanded(config.expandedGroups, groupId)
    const groupHeader: RenderableGroupHeader = {
      type: "group-header",
      groupId,
      columnId,
      value: group.label,
      depth,
      count: config.getGroupCount?.(groupId) ?? groupRows.length,
      isExpanded,
      groupPath: parentGroupPath,
    }

    result.push(groupHeader)

    // Only add children if the group is expanded
    if (isExpanded) {
      // If there's another grouping level, recursively group children
      if (depth + 1 < config.groupByColumns.length) {
        const childItems = buildGroupLevel(groupRows, config, depth + 1, groupPath)
        result.push(...childItems)
      } else {
        // No more grouping levels: add data rows
        const dataItems: RenderableDataRow<TData>[] = groupRows.map((row) => ({
          type: "data",
          rowId: row.rowId,
          data: row.data,
          groupPath,
        }))
        result.push(...dataItems)
      }
    }
  }

  return result
}

/**
 * Normalize group value to array of strings
 * Handles: string, string[], null, undefined
 */
function normalizeGroupValue(
  value: ResolvedGroupingValue | ResolvedGroupingValue[] | string | string[] | null | undefined,
): ResolvedGroupingValue[] {
  if (value === null || value === undefined) {
    return [{ key: "(Empty)", label: "(Empty)" }]
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "string"
        ? { key: entry, label: entry }
        : { key: entry.key, label: entry.label, sortValue: entry.sortValue },
    )
  }

  if (typeof value === "string") {
    return [{ key: value, label: value }]
  }

  return [{ key: value.key, label: value.label, sortValue: value.sortValue }]
}

/**
 * Sort group keys using priority: manual order > custom function > alphabetical
 */
function sortGroupKeys<TData>(
  groups: Array<{ key: string; label: string; sortValue?: string | number }>,
  columnId: string,
  config: GroupingConfig<TData>,
): Array<{ key: string; label: string; sortValue?: string | number }> {
  const manualOrder = config.manualOrder?.[columnId]
  const customSort = config.sortGroupValues

  return groups.slice().sort((a, b) => {
    // Priority 1: Manual ordering
    if (manualOrder) {
      const orderA = manualOrder[a.key] ?? manualOrder[a.label]
      const orderB = manualOrder[b.key] ?? manualOrder[b.label]

      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      if (orderA !== undefined) {
        return -1
      }
      if (orderB !== undefined) {
        return 1
      }
    }

    // Priority 2: Custom sort function
    if (customSort) {
      return customSort(columnId, a.label, b.label)
    }

    // Priority 3: Explicit sort value
    if (a.sortValue !== undefined || b.sortValue !== undefined) {
      const sortValueA = a.sortValue ?? a.label
      const sortValueB = b.sortValue ?? b.label

      if (typeof sortValueA === "number" && typeof sortValueB === "number") {
        return sortValueA - sortValueB
      }

      return String(sortValueA).localeCompare(String(sortValueB))
    }

    // Priority 4: Alphabetical
    return a.label.localeCompare(b.label)
  })
}

/**
 * Build unique group ID from parent path, column, and value
 * Example: "status:active" or "status:active|priority:high"
 */
function buildGroupId(parentGroupPath: string[], columnId: string, value: string): string {
  const segments = [...parentGroupPath, `${columnId}:${value}`]
  return segments.join("|")
}
