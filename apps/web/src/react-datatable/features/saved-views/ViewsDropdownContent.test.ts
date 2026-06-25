import { describe, expect, test } from "vitest"
import { buildDatatableViewState } from "../../state/lifecycle/table-state-snapshot"
import type { PersistedTableState } from "../../state/persistence/table-state-adapter.types"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"
import { groupDatatableViewsForDropdown } from "./ViewsDropdownContent"

describe("groupDatatableViewsForDropdown", () => {
  test("groups fixed views separately before private and workspace views", () => {
    const fixedView = datatableView("fixed_task_active", "Active", {
      readonly: true,
      source: "fixed",
    })
    const workspaceView = datatableView("view_workspace", "Workspace", { isShared: true })
    const privateView = datatableView("view_private", "Private")

    const grouped = groupDatatableViewsForDropdown([privateView, fixedView, workspaceView])

    expect(grouped.fixed.map((view) => view.id)).toEqual(["fixed_task_active"])
    expect(grouped.private.map((view) => view.id)).toEqual(["view_private"])
    expect(grouped.workspace.map((view) => view.id)).toEqual(["view_workspace"])
  })
})

function datatableView(
  id: string,
  name: string,
  extras: Partial<DatatableView> = {},
): DatatableView {
  return {
    createdAt: new Date(0),
    createdBy: "usr_1",
    id,
    isShared: false,
    isUserDefault: false,
    isWorkspaceDefault: false,
    name,
    state: buildDatatableViewState(persistedState()),
    updatedAt: new Date(0),
    ...extras,
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
