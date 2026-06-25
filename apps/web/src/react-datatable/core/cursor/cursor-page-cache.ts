import type { SortingState } from "@tanstack/react-table"
import type { ColumnFilter, DatatableQueryOptions, OnlineGroupingConfig } from "../../types/index"

export type CursorQueryInput<TCursor> = {
  mode: "cursor"
  limit: number
  cursor: TCursor | null
  filters: ColumnFilter[]
  sorting: SortingState
  globalFilter: string
  grouping?: OnlineGroupingConfig
  queryOptions: DatatableQueryOptions
}

export type CursorPage<TData, TCursor> = {
  cursor: TCursor | null
  rows: TData[]
  nextCursor: TCursor | null
  hasMore: boolean
}

export type CursorPageCache<TData, TCursor> = {
  signature: string
  pages: CursorPage<TData, TCursor>[]
  rows: TData[]
  nextCursor: TCursor | null
  hasMore: boolean
}

export function buildCursorQueryInput<TCursor>(
  input: Omit<CursorQueryInput<TCursor>, "mode">,
): CursorQueryInput<TCursor> {
  return {
    ...input,
    mode: "cursor",
  }
}

export function createCursorPageCache<TData, TCursor>({
  signature,
}: {
  signature: string
}): CursorPageCache<TData, TCursor> {
  return {
    signature,
    pages: [],
    rows: [],
    nextCursor: null,
    hasMore: true,
  }
}

export function appendCursorPage<TData, TCursor>(
  cache: CursorPageCache<TData, TCursor>,
  page: CursorPage<TData, TCursor>,
): CursorPageCache<TData, TCursor> {
  const pages = [...cache.pages, page]

  return {
    signature: cache.signature,
    pages,
    rows: pages.flatMap((entry) => entry.rows),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export function resetCursorPageCacheForSignature<TData, TCursor>(
  cache: CursorPageCache<TData, TCursor>,
  signature: string,
): CursorPageCache<TData, TCursor> {
  if (cache.signature === signature) {
    return cache
  }

  return createCursorPageCache<TData, TCursor>({ signature })
}
