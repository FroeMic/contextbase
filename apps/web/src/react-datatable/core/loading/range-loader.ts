import { useCallback, useEffect, useRef } from "react"
import { debug as debugLog } from "../../shared/utils/debug"
import type { UseOnlineDataReturn } from "../online/use-online-data"
import type { DisplayRowModel } from "../row-model/display-row-model"

export interface RenderedRowRange {
  rowStartIndex: number
  rowStopIndex: number
}

export type OnlineRangeLoadIntent = {
  type: "infinite"
  range: { dataStartIndex: number; dataStopIndex: number }
} | null

export function resolveOnlineRangeLoadIntent<TData>(options: {
  mode: "infinite" | "pagination" | null
  isEnabled: boolean
  range: RenderedRowRange
  displayRowModel: DisplayRowModel<TData>
  canFetchMore: boolean
  isFetchingNextPage: boolean
  prefetchRowThreshold: number
  now: number
  lastInfiniteFetchAt: number
  scrollThrottleMs: number
}): OnlineRangeLoadIntent {
  const { mode, isEnabled, range, displayRowModel, now, lastInfiniteFetchAt, scrollThrottleMs } =
    options

  if (!isEnabled || mode !== "infinite") {
    return null
  }

  const dataRange = displayRowModel.getDataRangeForRenderedRange(
    range.rowStartIndex,
    range.rowStopIndex,
  )

  if (!dataRange || now - lastInfiniteFetchAt < scrollThrottleMs) {
    return null
  }

  return { type: "infinite", range: dataRange }
}

export function useOnlineRangeLoader<TData>({
  onlineQuery,
  displayRowModel,
  rowHeight,
  debug,
}: {
  onlineQuery?: UseOnlineDataReturn<TData>
  displayRowModel: DisplayRowModel<TData>
  rowHeight: number
  debug?: boolean
}) {
  const lastInfiniteFetchAtRef = useRef(0)
  const virtualVisibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const virtualPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const virtualPendingVisibleSignatureRef = useRef<string | null>(null)
  const virtualPendingPrefetchSignatureRef = useRef<string | null>(null)
  const virtualLoadedVisibleSignatureRef = useRef<string | null>(null)
  const virtualLoadedPrefetchSignatureRef = useRef<string | null>(null)
  const virtualQuerySignatureRef = useRef<string | null>(null)
  const infiniteScrollThreshold = 500
  const scrollThrottleMs = 200
  const virtualVisibleLoadDelayMs = 40
  const virtualPrefetchDelayMs = 180
  const prefetchRowThreshold =
    onlineQuery?.prefetchRows ?? Math.max(5, Math.ceil(infiniteScrollThreshold / rowHeight))

  useEffect(() => {
    return () => {
      if (virtualVisibleTimerRef.current) {
        clearTimeout(virtualVisibleTimerRef.current)
      }
      if (virtualPrefetchTimerRef.current) {
        clearTimeout(virtualPrefetchTimerRef.current)
      }
    }
  }, [])

  return useCallback(
    (range: RenderedRowRange) => {
      if (!onlineQuery) {
        return
      }

      if (
        onlineQuery.mode === "infinite" &&
        virtualQuerySignatureRef.current !== onlineQuery.querySignature
      ) {
        virtualQuerySignatureRef.current = onlineQuery.querySignature
        virtualLoadedVisibleSignatureRef.current = null
        virtualLoadedPrefetchSignatureRef.current = null
        virtualPendingVisibleSignatureRef.current = null
        virtualPendingPrefetchSignatureRef.current = null
        if (virtualVisibleTimerRef.current) {
          clearTimeout(virtualVisibleTimerRef.current)
          virtualVisibleTimerRef.current = null
        }
        if (virtualPrefetchTimerRef.current) {
          clearTimeout(virtualPrefetchTimerRef.current)
          virtualPrefetchTimerRef.current = null
        }
      }

      const intent = resolveOnlineRangeLoadIntent({
        mode: onlineQuery.mode,
        isEnabled: onlineQuery.mode !== null,
        range,
        displayRowModel,
        canFetchMore: false,
        isFetchingNextPage: onlineQuery.isFetchingNextPage,
        prefetchRowThreshold,
        now: Date.now(),
        lastInfiniteFetchAt: lastInfiniteFetchAtRef.current,
        scrollThrottleMs,
      })

      if (!intent) {
        return
      }

      if (intent.type === "infinite") {
        const visibleSignature = `${intent.range.dataStartIndex}:${intent.range.dataStopIndex}:visible`
        const prefetchSignature = `${intent.range.dataStartIndex}:${intent.range.dataStopIndex}:prefetch:${onlineQuery.prefetchRows}`

        if (debug) {
          debugLog("range load", {
            mode: "infinite",
            renderedRange: range,
            dataRange: intent.range,
            pageSize: onlineQuery.pageSize,
            prefetchRows: onlineQuery.prefetchRows,
            loadedRows: displayRowModel.loadedRowCount,
            totalDataRows: onlineQuery.totalDataRows,
            virtualPages: onlineQuery.virtualPagesByOffset?.size,
            isFetching: onlineQuery.isFetching,
          })
        }

        if (
          visibleSignature !== virtualLoadedVisibleSignatureRef.current &&
          visibleSignature !== virtualPendingVisibleSignatureRef.current
        ) {
          if (virtualVisibleTimerRef.current) {
            clearTimeout(virtualVisibleTimerRef.current)
          }
          virtualPendingVisibleSignatureRef.current = visibleSignature
          virtualVisibleTimerRef.current = setTimeout(() => {
            virtualPendingVisibleSignatureRef.current = null
            virtualLoadedVisibleSignatureRef.current = visibleSignature
            onlineQuery.ensureDataRangeLoaded(intent.range, { prefetchRows: 0, overscanPages: 0 })
          }, virtualVisibleLoadDelayMs)
        }

        if (
          prefetchSignature !== virtualLoadedPrefetchSignatureRef.current &&
          prefetchSignature !== virtualPendingPrefetchSignatureRef.current
        ) {
          if (virtualPrefetchTimerRef.current) {
            clearTimeout(virtualPrefetchTimerRef.current)
          }
          virtualPendingPrefetchSignatureRef.current = prefetchSignature
          virtualPrefetchTimerRef.current = setTimeout(() => {
            virtualPendingPrefetchSignatureRef.current = null
            virtualLoadedPrefetchSignatureRef.current = prefetchSignature
            onlineQuery.ensureDataRangeLoaded(intent.range, {
              prefetchRows: onlineQuery.prefetchRows,
              overscanPages: 0,
            })
          }, virtualPrefetchDelayMs)
        }
        return
      }

      lastInfiniteFetchAtRef.current = Date.now()
    },
    [debug, displayRowModel, onlineQuery, prefetchRowThreshold],
  )
}
