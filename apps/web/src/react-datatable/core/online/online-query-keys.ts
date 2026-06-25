import { serializeExpandedStateForOnlineQuery } from "../../features/grouping/group-expansion"
import type {
  OnlineNavigationMode,
  OnlineQueryStateInput,
} from "../../types/props.types"

export const ONLINE_QUERY_STALE_TIME_MS = 5 * 60 * 1000

export function resolveOnlineQueryExpansionForMode(
  mode: OnlineNavigationMode,
  groupExpanded: Parameters<typeof serializeExpandedStateForOnlineQuery>[0],
) {
  if (mode === "infinite") {
    return serializeExpandedStateForOnlineQuery(true)
  }

  return serializeExpandedStateForOnlineQuery(groupExpanded)
}

export function buildOnlineQueryStateInput(input: {
  filters: OnlineQueryStateInput["filters"]
  globalFilter: OnlineQueryStateInput["globalFilter"]
  groupExpanded: Parameters<typeof serializeExpandedStateForOnlineQuery>[0]
  groupingColumns: string[]
  limit: number
  mode: OnlineNavigationMode
  showEmptyGroups: boolean
  sorting: OnlineQueryStateInput["sorting"]
}): OnlineQueryStateInput {
  return {
    limit: input.limit,
    filters: input.filters,
    sorting: input.sorting,
    globalFilter: input.globalFilter,
    grouping:
      input.groupingColumns.length > 0
        ? {
            columns: input.groupingColumns,
            showEmptyGroups: input.showEmptyGroups,
            expansion: resolveOnlineQueryExpansionForMode(input.mode, input.groupExpanded),
          }
        : undefined,
  }
}

export function buildInfiniteOnlineQueryKey(
  onlineQueryKey: readonly unknown[],
  queryStateSignature: string,
): readonly unknown[] {
  return [...onlineQueryKey, "infinite", queryStateSignature]
}

export function buildPaginationOnlineQueryKey(
  onlineQueryKey: readonly unknown[],
  queryStateSignature: string,
  pageIndex: number,
): readonly unknown[] {
  return [...onlineQueryKey, "pagination", queryStateSignature, pageIndex]
}
