import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { DatatableState } from "../../types/state.types"
import { defaultDatatableState } from "../../types/state.types"
import type { DatatableStore } from "./store.types"

export type { DatatableStore } from "./store.types"

/**
 * Store factory function
 * Creates an isolated Zustand store for each Datatable instance
 *
 * Pattern: Each table gets its own store to avoid state conflicts
 */
export const createDatatableStore = (initialState: Partial<DatatableStore> = {}) => {
  return create<DatatableStore>()(
    devtools(
      (set, get) => ({
        // Initial state
        ...defaultDatatableState,
        ...initialState,

        // Actions
        setState: (state) => set(state),

        resetState: () => set(defaultDatatableState),

        setGlobalFilter: (filter) => set({ globalFilter: filter }),

        setColumnFilters: (filters) => set({ columnFilters: filters }),

        setQueryOption: (key, value) => {
          set((state) => ({
            queryOptions: {
              ...state.queryOptions,
              [key]: value,
            },
          }))
        },

        setQueryOptions: (options) => set({ queryOptions: options }),

        resetQueryOptions: () => set({ queryOptions: {} }),

        // Column Filter Actions
        // Now type-safe with explicit filterType parameter
        setColumnFilter: (columnId, filterType, payload) => {
          const currentFilters = get().columnFilters

          if (payload === null) {
            // Remove filter if payload is null
            set({
              columnFilters: currentFilters.filter((f) => f.id !== columnId),
            })
          } else {
            const existingFilterIndex = currentFilters.findIndex((f) => f.id === columnId)
            const newFilter = { id: columnId, type: filterType, payload }

            if (existingFilterIndex !== -1) {
              // Update existing filter
              const newFilters = [...currentFilters]
              newFilters[existingFilterIndex] = newFilter
              set({ columnFilters: newFilters })
            } else {
              // Add new filter
              set({ columnFilters: [...currentFilters, newFilter] })
            }
          }
        },

        removeColumnFilter: (columnId) => {
          set((state) => ({
            columnFilters: state.columnFilters.filter((f) => f.id !== columnId),
          }))
        },

        clearAllFilters: () => set({ columnFilters: [] }),

        toggleFilterMode: () => {
          set((state) => ({
            filterMode: state.filterMode === "AND" ? "OR" : "AND",
          }))
        },

        setSorting: (sorting) => set({ sorting }),

        toggleColumnSort: (columnId, multi = false) => {
          set((state) => {
            const current = state.sorting.find((s) => s.id === columnId)
            let newSorting: DatatableState["sorting"]

            if (!current) {
              // Not sorted → asc
              newSorting = multi
                ? [...state.sorting, { id: columnId, desc: false }]
                : [{ id: columnId, desc: false }]
            } else if (!current.desc) {
              // Asc → desc
              newSorting = state.sorting.map((s) => (s.id === columnId ? { ...s, desc: true } : s))
            } else {
              // Desc → unsorted (remove)
              newSorting = state.sorting.filter((s) => s.id !== columnId)
            }

            return {
              sorting: newSorting,
              customSortOrder: null, // Clear manual sort order when column sort is applied
            }
          })
        },

        toggleSortDirection: (columnId) => {
          set((state) => {
            const current = state.sorting.find((s) => s.id === columnId)

            if (!current) {
              // Not sorted → asc (preserve other sorts)
              return {
                sorting: [...state.sorting, { id: columnId, desc: false }],
                customSortOrder: null,
              }
            }

            // Already sorted: toggle asc ↔ desc (never remove)
            return {
              sorting: state.sorting.map((s) => (s.id === columnId ? { ...s, desc: !s.desc } : s)),
              customSortOrder: null,
            }
          })
        },

        reorderSorting: (newOrder) => {
          set({ sorting: newOrder })
        },

        setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),

        toggleColumnVisibility: (columnId) => {
          const current = get().columnVisibility
          set({
            columnVisibility: {
              ...current,
              [columnId]: !(current[columnId] ?? true), // Default to visible if not set
            },
          })
        },

        resetColumnVisibility: () => set({ columnVisibility: {} }),

        setColumnWidths: (widths) => set({ columnWidths: widths }),

        setRowSelection: (selection) => set({ rowSelection: selection }),

        toggleRowSelection: (rowId) => {
          const current = get().rowSelection
          if (current.kind === "allMatching") {
            const nextExcludedIds = { ...current.excludedIds }

            if (nextExcludedIds[rowId]) {
              delete nextExcludedIds[rowId]
            } else {
              nextExcludedIds[rowId] = true
            }

            set({
              rowSelection: {
                ...current,
                excludedIds: nextExcludedIds,
                lastSingleSelectedRowId: rowId,
              },
            })
            return
          }

          const nextIds = { ...current.ids, ...current.rangeRowIds }
          if (nextIds[rowId]) {
            delete nextIds[rowId]
          } else {
            nextIds[rowId] = true
          }

          set({
            rowSelection: {
              ...current,
              ids: nextIds,
              rangeRowIds: {},
              lastSingleSelectedRowId: rowId,
            },
          })
        },

        setRowSelectionRange: ({ anchorRowId, rowIds }) => {
          const current = get().rowSelection
          if (current.kind === "allMatching") {
            return
          }
          const nextRangeIds = Object.fromEntries(rowIds.map((rowId) => [rowId, true])) as Record<
            string,
            true
          >

          set({
            rowSelection: {
              ...current,
              rangeRowIds: nextRangeIds,
              lastSingleSelectedRowId: anchorRowId,
            },
          })
        },

        selectAllMatching: ({ query, totalMatchingRows }) => {
          set({
            rowSelection: {
              kind: "allMatching",
              query,
              includedIds: {},
              excludedIds: {},
              lastSingleSelectedRowId: null,
              totalMatchingRows,
            },
          })
        },

        selectAll: () => {
          // Implementation will be completed when we have access to all row IDs
          // For now, just a placeholder
          set({
            rowSelection: {
              kind: "explicit",
              ids: {},
              rangeRowIds: {},
              lastSingleSelectedRowId: null,
            },
          })
        },

        deselectAll: () =>
          set({
            rowSelection: {
              kind: "explicit",
              ids: {},
              rangeRowIds: {},
              lastSingleSelectedRowId: null,
            },
            activeRowId: null,
            previewRowId: null,
            previewAnchorPoint: null,
          }),

        setActiveRow: (rowId) => set({ activeRowId: rowId }),

        setPreviewRow: (rowId, anchorPoint) =>
          set((state) => ({
            previewAnchorPoint: rowId ? (anchorPoint ?? state.previewAnchorPoint) : null,
            previewRowId: rowId,
          })),

        setColumnWidth: (columnId, width) => {
          set((state) => ({
            columnWidths: {
              ...state.columnWidths,
              [columnId]: width,
            },
          }))
        },

        resetColumnWidths: () => set({ columnWidths: {} }),

        // Grouping
        setGrouping: (grouping) => set({ grouping }),

        setGroupingOrder: (order) => set({ groupingOrder: order }),

        resetGrouping: () => set({ grouping: [], groupingOrder: {} }),

        // Group Expansion - custom expansion state for row grouping
        setGroupExpanded: (expanded) => set({ groupExpanded: expanded }),

        toggleGroupExpanded: (groupId) => {
          const current = get().groupExpanded

          // Handle two groupExpanded states:
          // 1. true: All groups expanded (default/initial state)
          //    → Transition to object state: { [groupId]: false }
          //    → This collapses the clicked group while keeping others expanded
          // 2. object: Specific expansion states per group
          //    → Toggle this specific group: !current[groupId]

          if (current === true) {
            // Transition from "all expanded" to selective state
            set({ groupExpanded: { [groupId]: false } })
          } else {
            // Toggle within existing object state
            set({
              groupExpanded: {
                ...current,
                [groupId]: !current[groupId],
              },
            })
          }
        },

        resetGroupExpanded: () => set({ groupExpanded: true }),

        setStickyColumnsCount: (count) => set({ stickyColumnsCount: count }),

        // Grid lines
        setShowHorizontalLines: (show) => set({ showHorizontalLines: show }),
        setShowVerticalLines: (show) => set({ showVerticalLines: show }),
        setShowEmptyGroups: (show) => set({ showEmptyGroups: show }),
        setShowOrderingBadge: (show) => set({ showOrderingBadge: show }),

        // Column Ordering
        setColumnOrder: (order) => set({ columnOrder: order }),

        reorderColumns: (fromIndex, toIndex) => {
          const currentOrder = get().columnOrder
          const newOrder = [...currentOrder]
          const [movedColumn] = newOrder.splice(fromIndex, 1)
          newOrder.splice(toIndex, 0, movedColumn)
          set({ columnOrder: newOrder })
        },

        resetColumnOrder: () => set({ columnOrder: [] }),

        resetDisplayOptions: () => {
          set({
            showColumnHeaders: true,
            stickyColumnsCount: 0,
            showHorizontalLines: false,
            showVerticalLines: false,
            showEmptyGroups: false,
            showOrderingBadge: true,
            sorting: [],
            columnVisibility: {},
            columnWidths: {},
            columnOrder: [],
            grouping: [],
            groupingOrder: {},
            groupExpanded: true,
          })
        },

        // Saved Views
        setActiveViewId: (viewId) => set({ activeViewId: viewId }),
      }),
      { name: "DatatableStore" },
    ),
  )
}
