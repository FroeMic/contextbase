import { describe, expect, test } from "vitest"
import { defaultDatatableState } from "../../types/state.types"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"
import { extractPersistedState } from "../persistence/table-state-adapter.types"
import {
  type BackendTableStateSnapshot,
  buildPersistedTableStateSnapshot,
  replayPersistedTableState,
  replaySavedViewState,
} from "./table-state-snapshot"

function persistedState(overrides: Partial<PersistedTableState> = {}): PersistedTableState {
  return {
    showColumnHeaders: true,
    stickyColumnsCount: 0,
    showHorizontalLines: false,
    showVerticalLines: false,
    showEmptyGroups: false,
    showOrderingBadge: true,
    columnOrder: ["title", "status"],
    columnVisibility: { status: true },
    columnWidths: { title: 240 },
    sorting: [{ id: "updatedAt", desc: true }],
    grouping: ["status"],
    groupingOrder: {},
    groupExpanded: true,
    globalFilter: "views",
    columnFilters: [],
    filterMode: "AND",
    activeViewId: "view_default",
    queryOptions: {
      showSubtasks: false,
      density: "compact",
      pageSize: 50,
      cursor: null,
    },
    ...overrides,
  }
}

describe("datatable table state snapshots", () => {
  test("stores domain query options under query.options", () => {
    const snapshot = buildPersistedTableStateSnapshot(persistedState())

    expect(snapshot.query.options).toEqual({
      showSubtasks: false,
      density: "compact",
      pageSize: 50,
      cursor: null,
    })
    expect("options" in snapshot.presentation).toBe(false)
  })

  test("extracts query options into persistable table state", () => {
    const extracted = extractPersistedState({
      ...defaultDatatableState,
      queryOptions: {
        showSubtasks: true,
      },
    })

    expect(extracted.queryOptions).toEqual({ showSubtasks: true })
  })

  test("replays domain query options from persisted and saved-view snapshots", () => {
    const snapshot = buildPersistedTableStateSnapshot(
      persistedState({
        queryOptions: {
          showSubtasks: true,
          mode: "zero-cursor",
        },
      }),
    )

    expect(replayPersistedTableState(snapshot).queryOptions).toEqual({
      showSubtasks: true,
      mode: "zero-cursor",
    })
    expect(replaySavedViewState(snapshot).queryOptions).toEqual({
      showSubtasks: true,
      mode: "zero-cursor",
    })
  })

  test("replays persisted group expansion overrides for grouped cursor tables", () => {
    const snapshot = buildPersistedTableStateSnapshot(
      persistedState({
        groupExpanded: {
          "status:done": false,
          "status:ready|priority:high": true,
        },
      }),
    )

    expect(replayPersistedTableState(snapshot).groupExpanded).toEqual({
      "status:done": false,
      "status:ready|priority:high": true,
    })
    expect(replaySavedViewState(snapshot).groupExpanded).toEqual({
      "status:done": false,
      "status:ready|priority:high": true,
    })
  })

  test("replays legacy snapshots without query.options as empty query options", () => {
    type LegacyBackendQueryState = Omit<BackendTableStateSnapshot["query"], "options">
    type LegacyBackendTableStateSnapshot = Omit<BackendTableStateSnapshot, "query"> & {
      query: LegacyBackendQueryState
    }

    const snapshot = buildPersistedTableStateSnapshot(persistedState())
    const legacySnapshot: LegacyBackendTableStateSnapshot = {
      ...snapshot,
      query: {
        filters: snapshot.query.filters,
        sorting: snapshot.query.sorting,
        globalFilter: snapshot.query.globalFilter,
        grouping: snapshot.query.grouping,
        filterMode: snapshot.query.filterMode,
      },
    }

    expect(
      replayPersistedTableState(legacySnapshot as BackendTableStateSnapshot).queryOptions,
    ).toEqual({})
  })

  test("normalizes legacy id-list filters to text-list payloads when replaying stored state", () => {
    const snapshot = buildPersistedTableStateSnapshot(
      persistedState({
        columnFilters: [
          {
            id: "assignee",
            type: "id-list",
            payload: { ids: ["usr_1"], mode: "include" },
          },
        ],
      }),
    )

    expect(replayPersistedTableState(snapshot).columnFilters).toEqual([
      {
        id: "assignee",
        type: "text-list",
        payload: { values: ["usr_1"], mode: "include" },
      },
    ])
    expect(replaySavedViewState(snapshot).columnFilters).toEqual([
      {
        id: "assignee",
        type: "text-list",
        payload: { values: ["usr_1"], mode: "include" },
      },
    ])
  })
})
