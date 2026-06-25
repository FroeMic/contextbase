import { describe, expect, test } from "vitest"
import { defaultDatatableState } from "../../types/state.types"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"
import type { DatatableView } from "../saved-views/datatable-view-adapter.types"
import { mergeStateWithPriority } from "./merge-state-with-priority"
import { buildDatatableViewState } from "./table-state-snapshot"

describe("mergeStateWithPriority", () => {
  test("applies linked fixed views above persisted state and below granular URL state", () => {
    const persisted = persistedState({
      activeViewId: "view_persisted",
      columnFilters: [
        {
          id: "status",
          payload: { mode: "include", values: ["done"] },
          type: "text-list",
        },
      ],
      globalFilter: "persisted",
      queryOptions: { showSubtasks: false, taskQueue: "persisted" },
      sorting: [{ id: "createdAt", desc: true }],
    })
    const linkedView = datatableView("fixed_task_active", {
      activeViewId: "fixed_task_active",
      columnFilters: [],
      globalFilter: "",
      queryOptions: { showSubtasks: false, taskQueue: "active" },
      sorting: [{ id: "updatedAt", desc: true }],
    })

    const state = mergeStateWithPriority({
      base: defaultDatatableState,
      linkedView,
      persistedState: persisted,
      urlState: {
        globalFilter: "url search",
      },
    })

    expect(state.activeViewId).toBe("fixed_task_active")
    expect(state.columnFilters).toEqual([])
    expect(state.globalFilter).toBe("url search")
    expect(state.queryOptions).toEqual({ showSubtasks: false, taskQueue: "active" })
    expect(state.sorting).toEqual([{ id: "updatedAt", desc: true }])
  })

  test("preserves persisted column widths when applying linked fixed views", () => {
    const persisted = persistedState({
      columnWidths: {
        assignee: 220,
        title: 480,
      },
      queryOptions: { showSubtasks: false, taskQueue: "persisted" },
    })
    const linkedView = datatableView(
      "fixed_task_input_required",
      {
        columnWidths: {},
        queryOptions: { showSubtasks: true, taskQueue: "input-required" },
        sorting: [{ id: "priority", desc: false }],
      },
      { readonly: true },
    )

    const state = mergeStateWithPriority({
      base: defaultDatatableState,
      linkedView,
      persistedState: persisted,
    })

    expect(state.activeViewId).toBe("fixed_task_input_required")
    expect(state.columnWidths).toEqual({
      assignee: 220,
      title: 480,
    })
    expect(state.queryOptions).toEqual({ showSubtasks: true, taskQueue: "input-required" })
    expect(state.sorting).toEqual([{ id: "priority", desc: false }])
  })

  test("applies saved column widths when applying mutable linked views", () => {
    const persisted = persistedState({
      columnWidths: {
        assignee: 220,
        title: 480,
      },
    })
    const linkedView = datatableView("view_custom_layout", {
      columnWidths: {
        assignee: 180,
        title: 360,
      },
    })

    const state = mergeStateWithPriority({
      base: defaultDatatableState,
      linkedView,
      persistedState: persisted,
    })

    expect(state.activeViewId).toBe("view_custom_layout")
    expect(state.columnWidths).toEqual({
      assignee: 180,
      title: 360,
    })
  })
})

function datatableView(
  id: string,
  overrides: Partial<PersistedTableState>,
  options: { readonly?: boolean } = {},
): DatatableView {
  return {
    createdAt: new Date(0),
    createdBy: "system",
    id,
    isShared: true,
    isUserDefault: false,
    isWorkspaceDefault: false,
    name: id,
    readonly: options.readonly,
    state: buildDatatableViewState(persistedState(overrides)),
    updatedAt: new Date(0),
  }
}

function persistedState(overrides: Partial<PersistedTableState> = {}): PersistedTableState {
  return {
    activeViewId: null,
    columnFilters: [],
    columnOrder: [],
    columnVisibility: {},
    columnWidths: {},
    filterMode: "AND",
    globalFilter: "",
    groupExpanded: true,
    grouping: [],
    groupingOrder: {},
    queryOptions: {},
    showColumnHeaders: true,
    showEmptyGroups: false,
    showHorizontalLines: false,
    showOrderingBadge: true,
    showVerticalLines: false,
    sorting: [],
    stickyColumnsCount: 0,
    ...overrides,
  }
}
