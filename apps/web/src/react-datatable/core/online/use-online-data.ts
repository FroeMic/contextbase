import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { deepEqual } from "../../shared/utils/deep-equal"
import type { DatatableRuntimeRestorationOptions } from "../../state/lifecycle/runtime-restoration"
import {
  getRuntimePaginationState,
  setRuntimePaginationState,
} from "../../state/lifecycle/runtime-restoration"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type {
  InfiniteOnlineQueryInput,
  OnlineConfig,
  OnlineGroupingSummary,
  OnlineNavigationMode,
  OnlineQueryResponse,
  OnlineQueryStateInput,
  PaginationOnlineQueryInput,
} from "../../types/props.types"
import type { RenderableRow } from "../../types/renderable-row.types"
import {
  buildInfiniteOnlineQueryKey,
  buildOnlineQueryStateInput,
  buildPaginationOnlineQueryKey,
  ONLINE_QUERY_STALE_TIME_MS,
} from "./online-query-keys"
import { getInitialVirtualPageOffsets, getVirtualPageOffsetsForRange } from "./virtual-online-data"

interface OnlineDataStateBase<TData> {
  mode: OnlineNavigationMode | null
  data: TData[]
  renderableRows?: RenderableRow<TData>[]
  virtualPagesByOffset?: Map<number, OnlineQueryResponse<TData>>
  liveDataVersion?: unknown
  grouping?: OnlineGroupingSummary
  pageSize: number
  total: number
  totalDataRows: number
  totalRenderedRows: number
  facets?: Record<string, Array<{ value: string; count: number }>>
  prefetchRows: number
  isLoading: boolean
  isFetching: boolean
  isRefetching: boolean
  error: Error | null
  isError: boolean
  querySignature: string | null
  ensureDataRangeLoaded: (
    range: { dataStartIndex: number; dataStopIndex: number },
    options?: { prefetchRows?: number; overscanPages?: number },
  ) => void
}

interface PaginationOnlineDataState<TData> extends OnlineDataStateBase<TData> {
  mode: "pagination"
  isFetchingNextPage: false
  hasNextPage: boolean
  fetchNextPage: () => Promise<undefined>
  pageIndex: number
  setPageIndex: (pageIndex: number) => void
  setPageSize: (pageSize: number) => void
  pageCount: number
  canPreviousPage: boolean
  canNextPage: boolean
}

interface InfiniteOnlineDataState<TData> extends OnlineDataStateBase<TData> {
  mode: "infinite"
  isFetchingNextPage: false
  hasNextPage: boolean
  fetchNextPage: () => Promise<undefined>
  pageIndex: 0
  setPageIndex: (_pageIndex: number) => void
  setPageSize: (_pageSize: number) => void
  pageCount: number
  canPreviousPage: false
  canNextPage: boolean
}

interface OfflineDataState<TData> extends OnlineDataStateBase<TData> {
  mode: null
  isFetchingNextPage: false
  hasNextPage: false
  fetchNextPage: () => Promise<undefined>
  pageIndex: 0
  setPageIndex: (_pageIndex: number) => void
  setPageSize: (_pageSize: number) => void
  pageCount: 0
  canPreviousPage: false
  canNextPage: false
}

export type UseOnlineDataReturn<TData> =
  | PaginationOnlineDataState<TData>
  | InfiniteOnlineDataState<TData>
  | OfflineDataState<TData>

const OFFLINE_QUERY_KEY = ["datatable-online-disabled"] as const

const resolveResponseItems = <TData>(response: OnlineQueryResponse<TData> | undefined): TData[] =>
  response?.rows.flatMap((row) => (row.type === "data" ? [row.item] : [])) ?? []

const resolveRenderableRows = <TData>(
  response: OnlineQueryResponse<TData> | undefined,
): RenderableRow<TData>[] | undefined =>
  response?.rows.map((row) => {
    if (row.type === "group-header") {
      return {
        type: "group-header",
        groupId: row.groupId,
        columnId: row.columnId,
        value: row.value,
        depth: row.depth,
        count: row.count,
        isExpanded: row.isExpanded ?? true,
        groupPath: row.groupPath,
      }
    }

    return {
      type: "data",
      rowId: row.rowId,
      data: row.item,
      dataIndex: row.dataIndex,
      groupPath: row.groupPath,
    }
  })

const resolveResponseTotal = <TData>(response: OnlineQueryResponse<TData> | undefined): number => {
  if (!response) {
    return 0
  }

  return response.totalDataRows
}

const resolveRenderedTotal = <TData>(response: OnlineQueryResponse<TData> | undefined): number => {
  if (!response) {
    return 0
  }

  return response.totalRenderedRows
}

const noopSetPageIndex: (pageIndex: number) => void = () => undefined
const noopSetPageSize: (pageSize: number) => void = () => undefined
const noopEnsureDataRangeLoaded: OnlineDataStateBase<unknown>["ensureDataRangeLoaded"] = () =>
  undefined

export { resolveOnlineQueryExpansionForMode } from "./online-query-keys"

function getCachedInfinitePages<TData>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
): Map<number, OnlineQueryResponse<TData>> {
  const pages = new Map<number, OnlineQueryResponse<TData>>()

  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    const offset = query.queryKey.at(-1)
    if (typeof offset !== "number") {
      continue
    }

    const response = query.state.data as OnlineQueryResponse<TData> | undefined
    if (response) {
      pages.set(offset, response)
    }
  }

  return pages
}

/**
 * Hook for online mode data fetching.
 *
 * Bridges Zustand state (filters, sorting, search) to the configured query
 * function and exposes a normalized controller shape for both infinite-loading
 * and paginated modes.
 */
export function useOnlineData<TData>(
  online: OnlineConfig<TData> | undefined,
  supportedGroupingColumns?: string[],
  supportedSortingColumns?: string[],
  runtimeRestoration?: DatatableRuntimeRestorationOptions | null,
): UseOnlineDataReturn<TData> {
  const queryClient = useQueryClient()
  const columnFilters = useDatatableStore((s) => s.columnFilters)
  const sorting = useDatatableStore((s) => s.sorting)
  const globalFilter = useDatatableStore((s) => s.globalFilter)
  const groupingState = useDatatableStore((s) => s.grouping)
  const groupExpanded = useDatatableStore((s) => s.groupExpanded)
  const showEmptyGroups = useDatatableStore((s) => s.showEmptyGroups)

  const onlineMode = online?.mode
  const onlineOnResponse = online?.onResponse
  const onlineQuery = online?.query
  const onlineQueryKeySignature = JSON.stringify(online?.queryKey ?? OFFLINE_QUERY_KEY)
  const onlineQueryKey = useMemo(
    () => JSON.parse(onlineQueryKeySignature) as readonly unknown[],
    [onlineQueryKeySignature],
  )
  const configuredPageSize = online?.pageSize ?? 50
  const initialPageIndex = online?.initialPageIndex ?? 0
  const allowedGroupingColumns = supportedGroupingColumns ?? online?.supportedGroupingColumns

  const sanitizedGrouping = useMemo(() => {
    if (!allowedGroupingColumns) {
      return groupingState
    }

    const supported = new Set(allowedGroupingColumns)
    return groupingState.filter((columnId) => supported.has(columnId))
  }, [groupingState, allowedGroupingColumns])
  const sanitizedSorting = useMemo(() => {
    if (!supportedSortingColumns) {
      return sorting
    }

    const supported = new Set(supportedSortingColumns)
    return sorting.filter((entry) => supported.has(entry.id))
  }, [sorting, supportedSortingColumns])

  const navigationSignature = useMemo(
    () =>
      onlineMode
        ? JSON.stringify([
            onlineQueryKey,
            onlineMode,
            columnFilters,
            sanitizedSorting,
            globalFilter,
            sanitizedGrouping,
            showEmptyGroups,
            groupExpanded,
          ])
        : JSON.stringify(OFFLINE_QUERY_KEY),
    [
      columnFilters,
      globalFilter,
      groupExpanded,
      onlineMode,
      onlineQueryKey,
      sanitizedGrouping,
      showEmptyGroups,
      sanitizedSorting,
    ],
  )

  const restoredPaginationState =
    onlineMode === "pagination" && runtimeRestoration?.pagination
      ? getRuntimePaginationState(runtimeRestoration.key, navigationSignature)
      : null

  const [pageSize, setPageSizeState] = useState(
    restoredPaginationState?.pageSize ?? configuredPageSize,
  )
  const prefetchRows = Math.max(0, Math.floor(online?.prefetchRows ?? pageSize))
  const [pageIndex, setPageIndex] = useState(restoredPaginationState?.pageIndex ?? initialPageIndex)
  const [paginationResponse, setPaginationResponse] = useState<
    OnlineQueryResponse<TData> | undefined
  >(undefined)
  const [paginationIsLoading, setPaginationIsLoading] = useState(false)
  const [paginationIsFetching, setPaginationIsFetching] = useState(false)
  const [paginationError, setPaginationError] = useState<Error | null>(null)
  const paginationRequestIdRef = useRef(0)
  const paginationResponseRef = useRef(paginationResponse)

  const setPageSize = useCallback((nextPageSize: number) => {
    setPageIndex(0)
    setPageSizeState(nextPageSize)
  }, [])

  useEffect(() => {
    setPageSizeState(restoredPaginationState?.pageSize ?? configuredPageSize)
  }, [configuredPageSize, restoredPaginationState?.pageSize])

  const queryStateInput: OnlineQueryStateInput = useMemo(
    () =>
      buildOnlineQueryStateInput({
        limit: pageSize,
        filters: columnFilters,
        sorting: sanitizedSorting,
        globalFilter,
        groupingColumns: sanitizedGrouping,
        showEmptyGroups,
        groupExpanded,
        mode: onlineMode ?? "infinite",
      }),
    [
      pageSize,
      columnFilters,
      sanitizedSorting,
      globalFilter,
      sanitizedGrouping,
      showEmptyGroups,
      groupExpanded,
      onlineMode,
    ],
  )
  const queryStateSignature = useMemo(() => JSON.stringify(queryStateInput), [queryStateInput])
  const queryStateInputRef = useRef(queryStateInput)
  queryStateInputRef.current = queryStateInput
  const initialInfiniteData =
    onlineMode === "infinite" &&
    online?.initialData &&
    (!online.initialDataQueryState || deepEqual(queryStateInput, online.initialDataQueryState))
      ? online.initialData
      : undefined
  const initialPaginationData =
    onlineMode === "pagination" &&
    pageIndex === initialPageIndex &&
    online?.initialData &&
    (!online.initialDataQueryState || deepEqual(queryStateInput, online.initialDataQueryState))
      ? online.initialData
      : undefined

  useEffect(() => {
    if (onlineMode !== "pagination") {
      return
    }

    setPageIndex(restoredPaginationState?.pageIndex ?? initialPageIndex)
  }, [initialPageIndex, onlineMode, restoredPaginationState?.pageIndex])

  useEffect(() => {
    if (onlineMode !== "pagination" || !runtimeRestoration?.pagination) {
      return
    }

    setRuntimePaginationState(runtimeRestoration.key, navigationSignature, {
      pageIndex,
      pageSize,
    })
  }, [navigationSignature, onlineMode, pageIndex, pageSize, runtimeRestoration])

  const paginationQueryKey = useMemo<readonly unknown[]>(
    () =>
      onlineMode
        ? buildPaginationOnlineQueryKey(onlineQueryKey, queryStateSignature, pageIndex)
        : OFFLINE_QUERY_KEY,
    [onlineMode, onlineQueryKey, queryStateSignature, pageIndex],
  )
  const paginationQuerySignature = useMemo(
    () => JSON.stringify(paginationQueryKey),
    [paginationQueryKey],
  )

  const infiniteQueryKey = useMemo<readonly unknown[]>(
    () =>
      onlineMode
        ? buildInfiniteOnlineQueryKey(onlineQueryKey, queryStateSignature)
        : OFFLINE_QUERY_KEY,
    [onlineMode, onlineQueryKey, queryStateSignature],
  )
  const infiniteQuerySignature = useMemo(() => JSON.stringify(infiniteQueryKey), [infiniteQueryKey])
  const initialCachedInfinitePages = useMemo<Map<number, OnlineQueryResponse<TData>>>(() => {
    if (onlineMode !== "infinite") {
      return new Map()
    }

    const pages = getCachedInfinitePages<TData>(queryClient, infiniteQueryKey)
    if (initialInfiniteData) {
      pages.set(0, initialInfiniteData)
    }

    return pages
  }, [infiniteQueryKey, initialInfiniteData, onlineMode, queryClient])
  const [virtualPagesByOffset, setVirtualPagesByOffset] = useState(initialCachedInfinitePages)
  const [virtualFetchingOffsets, setVirtualFetchingOffsets] = useState<Set<number>>(new Set())
  const [virtualError, setVirtualError] = useState<Error | null>(null)
  const virtualPagesByOffsetRef = useRef(virtualPagesByOffset)
  const virtualFetchingOffsetsRef = useRef(virtualFetchingOffsets)
  const virtualQuerySignatureRef = useRef(infiniteQuerySignature)

  useEffect(() => {
    virtualPagesByOffsetRef.current = virtualPagesByOffset
  }, [virtualPagesByOffset])

  useEffect(() => {
    virtualFetchingOffsetsRef.current = virtualFetchingOffsets
  }, [virtualFetchingOffsets])

  useEffect(() => {
    paginationResponseRef.current = paginationResponse
  }, [paginationResponse])

  useEffect(() => {
    void infiniteQuerySignature

    if (onlineMode !== "infinite") {
      return
    }

    const currentInfiniteQueryKey = JSON.parse(infiniteQuerySignature) as readonly unknown[]
    const nextPages = getCachedInfinitePages<TData>(queryClient, currentInfiniteQueryKey)
    if (initialInfiniteData) {
      nextPages.set(0, initialInfiniteData)
    }

    virtualQuerySignatureRef.current = infiniteQuerySignature

    const currentQueryStateInput = queryStateInputRef.current
    for (const [offset, response] of nextPages) {
      onlineOnResponse?.({ ...currentQueryStateInput, mode: "infinite", offset }, response)
    }

    if (nextPages.size > 0 || virtualPagesByOffsetRef.current.size === 0) {
      virtualPagesByOffsetRef.current = nextPages
      virtualFetchingOffsetsRef.current = new Set()
      setVirtualPagesByOffset(nextPages)
      setVirtualFetchingOffsets(new Set())
      setVirtualError(null)
      return
    }

    const requestSignature = infiniteQuerySignature
    const offset = 0
    const nextFetchingOffsets = new Set<number>([offset])
    virtualFetchingOffsetsRef.current = nextFetchingOffsets
    setVirtualFetchingOffsets(nextFetchingOffsets)
    setVirtualError(null)

    const input: InfiniteOnlineQueryInput = {
      ...currentQueryStateInput,
      mode: "infinite",
      offset,
    }

    void queryClient
      .ensureQueryData({
        queryFn: () =>
          onlineQuery?.(input) ?? Promise.reject(new Error("Online query is disabled.")),
        queryKey: [...currentInfiniteQueryKey, offset],
        staleTime: ONLINE_QUERY_STALE_TIME_MS,
      })
      .then((response) => {
        if (virtualQuerySignatureRef.current !== requestSignature) {
          return
        }

        onlineOnResponse?.(input, response)
        const replacementPages = new Map<number, OnlineQueryResponse<TData>>([[offset, response]])
        virtualPagesByOffsetRef.current = replacementPages
        setVirtualPagesByOffset(replacementPages)
        setVirtualError(null)
      })
      .catch((error: unknown) => {
        if (virtualQuerySignatureRef.current !== requestSignature) {
          return
        }

        setVirtualError(error instanceof Error ? error : new Error(String(error)))
      })
      .finally(() => {
        if (virtualQuerySignatureRef.current !== requestSignature) {
          return
        }

        virtualFetchingOffsetsRef.current = new Set()
        setVirtualFetchingOffsets(new Set())
      })
  }, [
    infiniteQuerySignature,
    initialInfiniteData,
    onlineMode,
    onlineOnResponse,
    onlineQuery,
    queryClient,
  ])

  const fetchInfinitePage = useCallback(
    (offset: number) => {
      if (!onlineQuery || onlineMode !== "infinite") {
        return
      }

      if (
        virtualPagesByOffsetRef.current.has(offset) ||
        virtualFetchingOffsetsRef.current.has(offset)
      ) {
        return
      }

      const nextFetchingOffsets = new Set(virtualFetchingOffsetsRef.current)
      nextFetchingOffsets.add(offset)
      virtualFetchingOffsetsRef.current = nextFetchingOffsets
      setVirtualFetchingOffsets(nextFetchingOffsets)

      const input: InfiniteOnlineQueryInput = {
        ...queryStateInputRef.current,
        mode: "infinite",
        offset,
      }
      const currentInfiniteQueryKey = JSON.parse(infiniteQuerySignature) as readonly unknown[]

      void queryClient
        .ensureQueryData({
          queryFn: () => onlineQuery(input),
          queryKey: [...currentInfiniteQueryKey, offset],
          staleTime: ONLINE_QUERY_STALE_TIME_MS,
        })
        .then((response) => {
          if (virtualQuerySignatureRef.current !== infiniteQuerySignature) {
            return
          }

          onlineOnResponse?.(input, response)
          const nextPages = new Map(virtualPagesByOffsetRef.current)
          nextPages.set(offset, response)
          virtualPagesByOffsetRef.current = nextPages
          setVirtualPagesByOffset(nextPages)
          setVirtualError(null)
        })
        .catch((error: unknown) => {
          if (virtualQuerySignatureRef.current !== infiniteQuerySignature) {
            return
          }

          setVirtualError(error instanceof Error ? error : new Error(String(error)))
        })
        .finally(() => {
          if (virtualQuerySignatureRef.current !== infiniteQuerySignature) {
            return
          }

          const remainingOffsets = new Set(virtualFetchingOffsetsRef.current)
          remainingOffsets.delete(offset)
          virtualFetchingOffsetsRef.current = remainingOffsets
          setVirtualFetchingOffsets(remainingOffsets)
        })
    },
    [infiniteQuerySignature, onlineMode, onlineOnResponse, onlineQuery, queryClient],
  )

  useEffect(() => {
    if (onlineMode !== "infinite" || initialInfiniteData) {
      return
    }

    fetchInfinitePage(0)
  }, [fetchInfinitePage, initialInfiniteData, onlineMode])

  useEffect(() => {
    if (onlineMode !== "infinite") {
      return
    }

    const firstPage = virtualPagesByOffset.get(0)
    if (!firstPage) {
      return
    }

    const offsets = getInitialVirtualPageOffsets({
      pageSize,
      totalDataRows: firstPage.totalDataRows,
      prefetchRows,
    })

    for (const offset of offsets) {
      fetchInfinitePage(offset)
    }
  }, [fetchInfinitePage, onlineMode, pageSize, prefetchRows, virtualPagesByOffset])

  useEffect(() => {
    if (onlineMode !== "pagination") {
      setPaginationResponse(undefined)
      setPaginationIsLoading(false)
      setPaginationIsFetching(false)
      setPaginationError(null)
      return
    }

    if (initialPaginationData) {
      onlineOnResponse?.(
        {
          ...queryStateInputRef.current,
          mode: "pagination",
          pageIndex,
          offset: pageIndex * pageSize,
        },
        initialPaginationData,
      )
      setPaginationResponse(initialPaginationData)
      setPaginationIsLoading(false)
      setPaginationIsFetching(false)
      setPaginationError(null)
      return
    }

    const requestId = paginationRequestIdRef.current + 1
    paginationRequestIdRef.current = requestId
    const hadPreviousResponse = paginationResponseRef.current !== undefined

    setPaginationIsLoading(!hadPreviousResponse)
    setPaginationIsFetching(true)

    const input: PaginationOnlineQueryInput = {
      ...queryStateInputRef.current,
      mode: "pagination",
      pageIndex,
      offset: pageIndex * pageSize,
    }
    const cachedResponse = queryClient.getQueryData<OnlineQueryResponse<TData>>(paginationQueryKey)

    if (cachedResponse) {
      onlineOnResponse?.(input, cachedResponse)
      setPaginationResponse(cachedResponse)
      setPaginationIsLoading(false)
    }

    void queryClient
      .ensureQueryData({
        queryFn: () =>
          onlineQuery?.(input) ?? Promise.reject(new Error("Online query is disabled.")),
        queryKey: paginationQueryKey,
        staleTime: ONLINE_QUERY_STALE_TIME_MS,
      })
      .then((response) => {
        if (paginationRequestIdRef.current !== requestId) {
          return
        }

        onlineOnResponse?.(input, response)
        setPaginationResponse(response)
        setPaginationError(null)
      })
      .catch((error: unknown) => {
        if (paginationRequestIdRef.current !== requestId) {
          return
        }

        setPaginationError(error instanceof Error ? error : new Error(String(error)))
      })
      .finally(() => {
        if (paginationRequestIdRef.current !== requestId) {
          return
        }

        setPaginationIsLoading(false)
        setPaginationIsFetching(false)
      })
  }, [
    initialPaginationData,
    onlineMode,
    onlineOnResponse,
    onlineQuery,
    pageIndex,
    pageSize,
    paginationQueryKey,
    queryClient,
  ])

  useEffect(() => {
    if (onlineMode !== "pagination" || !paginationResponse) {
      return
    }

    const totalRenderedRows = resolveRenderedTotal(paginationResponse)
    const nextPageCount = totalRenderedRows === 0 ? 0 : Math.ceil(totalRenderedRows / pageSize)
    if (nextPageCount > 0 && pageIndex >= nextPageCount) {
      setPageIndex(nextPageCount - 1)
    }
  }, [onlineMode, pageIndex, pageSize, paginationResponse])

  if (!online) {
    return {
      mode: null,
      data: [],
      renderableRows: undefined,
      virtualPagesByOffset: undefined,
      liveDataVersion: undefined,
      grouping: undefined,
      pageSize,
      total: 0,
      totalDataRows: 0,
      totalRenderedRows: 0,
      facets: undefined,
      prefetchRows,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      isError: false,
      querySignature: null,
      ensureDataRangeLoaded: noopEnsureDataRangeLoaded,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: async () => undefined,
      pageIndex: 0,
      setPageIndex: noopSetPageIndex,
      setPageSize: noopSetPageSize,
      pageCount: 0,
      canPreviousPage: false,
      canNextPage: false,
    }
  }

  if (online.mode === "infinite") {
    const firstPage = virtualPagesByOffset.get(0)
    const total = firstPage?.totalDataRows ?? 0
    const totalRenderedRows = firstPage?.totalRenderedRows ?? total
    const isFetching = virtualFetchingOffsets.size > 0
    const ensureDataRangeLoaded: OnlineDataStateBase<TData>["ensureDataRangeLoaded"] = (
      { dataStartIndex, dataStopIndex },
      options,
    ) => {
      const offsets = getVirtualPageOffsetsForRange({
        rowStartIndex: dataStartIndex,
        rowStopIndex: dataStopIndex,
        pageSize,
        totalDataRows: total,
        overscanPages: options?.overscanPages ?? 0,
        prefetchRows: options?.prefetchRows ?? prefetchRows,
      })

      for (const offset of offsets) {
        fetchInfinitePage(offset)
      }
    }

    return {
      mode: "infinite",
      data: [],
      renderableRows: undefined,
      virtualPagesByOffset,
      liveDataVersion: online.liveDataVersion,
      grouping: firstPage?.grouping,
      pageSize,
      total,
      totalDataRows: total,
      totalRenderedRows,
      facets: firstPage?.facets,
      prefetchRows,
      isLoading: !firstPage,
      isFetching,
      isRefetching: Boolean(firstPage && isFetching),
      error: virtualError,
      isError: Boolean(virtualError),
      querySignature: infiniteQuerySignature,
      ensureDataRangeLoaded,
      isFetchingNextPage: false,
      hasNextPage: total === 0 ? false : virtualPagesByOffset.size * pageSize < total,
      fetchNextPage: async () => undefined,
      pageIndex: 0,
      setPageIndex: noopSetPageIndex,
      setPageSize: noopSetPageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
      canPreviousPage: false,
      canNextPage: total === 0 ? false : virtualPagesByOffset.size * pageSize < total,
    }
  }

  if (online.mode === "pagination") {
    const response = paginationResponse
    const data = resolveResponseItems(response)
    const total = resolveResponseTotal(response)
    const renderableRows = resolveRenderableRows(response)
    const totalRenderedRows = resolveRenderedTotal(response)
    const pageCount = totalRenderedRows === 0 ? 0 : Math.ceil(totalRenderedRows / pageSize)
    const canNextPage = pageIndex + 1 < pageCount

    return {
      mode: "pagination",
      data,
      renderableRows,
      virtualPagesByOffset: undefined,
      liveDataVersion: online.liveDataVersion,
      grouping: response?.grouping,
      pageSize,
      total,
      totalDataRows: total,
      totalRenderedRows,
      facets: response?.facets,
      prefetchRows,
      isLoading: paginationIsLoading,
      isFetching: paginationIsFetching,
      isRefetching: Boolean(response && paginationIsFetching),
      error: paginationError,
      isError: Boolean(paginationError),
      querySignature: paginationQuerySignature,
      ensureDataRangeLoaded: noopEnsureDataRangeLoaded,
      isFetchingNextPage: false,
      hasNextPage: canNextPage,
      fetchNextPage: async () => undefined,
      pageIndex,
      setPageIndex,
      setPageSize,
      pageCount,
      canPreviousPage: pageIndex > 0,
      canNextPage,
    }
  }

  throw new Error(`Unsupported online mode: ${String((online as { mode?: unknown }).mode)}`)
}
