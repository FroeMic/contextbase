import { describe, expect, test } from "vitest"
import { buildDatatableViewState } from "../lifecycle/table-state-snapshot"
import type { PersistedTableState } from "../persistence/table-state-adapter.types"
import type { DatatableView } from "./datatable-view-adapter.types"
import {
  assertMutableDatatableView,
  defaultDatatableFixedViews,
  isReadonlyDatatableView,
  mergeDatatableFixedViews,
  resolveLinkedDatatableView,
  viewsAfterDatatableAdapterLoadError,
} from "./use-datatable-views"

describe("datatable fixed views", () => {
  test("uses a stable empty fixed view list when fixed views are omitted", () => {
    expect(defaultDatatableFixedViews()).toBe(defaultDatatableFixedViews())
  })

  test("prepends fixed readonly views without adapter-backed mutations", () => {
    const userView = datatableView("view_user", "User View")
    const fixedView = datatableView("fixed_task_active", "Active", {
      readonly: true,
      slug: "active",
      source: "fixed",
    })

    const merged = mergeDatatableFixedViews([userView], [fixedView])

    expect(merged.map((view) => view.id)).toEqual(["fixed_task_active", "view_user"])
    expect(merged[0]).toMatchObject({
      createdBy: "system",
      id: "fixed_task_active",
      isShared: true,
      isUserDefault: false,
      isWorkspaceDefault: false,
      readonly: true,
      slug: "active",
      source: "fixed",
    })
    expect(isReadonlyDatatableView(merged[0])).toBe(true)
    expect(isReadonlyDatatableView(merged[1])).toBe(false)
  })

  test("keeps fixed views when adapter views contain colliding ids", () => {
    const adapterCollision = datatableView("fixed_task_active", "Mutable collision", {
      createdBy: "usr_1",
      readonly: false,
      slug: "active",
      source: "user",
    })
    const fixedView = datatableView("fixed_task_active", "Active", {
      createdBy: "system",
      readonly: true,
      slug: "active",
      source: "fixed",
    })

    const merged = mergeDatatableFixedViews([adapterCollision], [fixedView])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      createdBy: "system",
      id: "fixed_task_active",
      name: "Active",
      readonly: true,
      source: "fixed",
    })
  })

  test("falls back to fixed views when adapter view loading fails", () => {
    const fixedView = datatableView("fixed_task_active", "Active", {
      readonly: true,
      slug: "active",
      source: "fixed",
    })

    const recovered = viewsAfterDatatableAdapterLoadError([fixedView])

    expect(recovered.map((view) => view.id)).toEqual(["fixed_task_active"])
    expect(recovered[0]).toMatchObject({
      createdBy: "system",
      name: "Active",
      readonly: true,
      source: "fixed",
    })
  })

  test("rejects adapter mutations for readonly views", () => {
    const fixedView = datatableView("fixed_task_active", "Active", {
      readonly: true,
      slug: "active",
      source: "fixed",
    })

    expect(() => assertMutableDatatableView(fixedView, "update")).toThrow(
      "Cannot update readonly datatable view fixed_task_active",
    )
    expect(() => assertMutableDatatableView(null, "delete")).toThrow(
      "Cannot delete unknown datatable view",
    )
  })

  test("resolves linked views by fixed slug only", () => {
    const userView = datatableView("view_user", "User View", { slug: "active" })
    const fixedView = datatableView("fixed_task_active", "Active", {
      readonly: true,
      slug: "active",
      source: "fixed",
    })

    expect(resolveLinkedDatatableView([userView, fixedView], "active")?.id).toBe(
      "fixed_task_active",
    )
    expect(resolveLinkedDatatableView([fixedView], "missing")).toBeNull()
    expect(resolveLinkedDatatableView([fixedView], null)).toBeNull()
  })
})

function datatableView(
  id: string,
  name: string,
  extras: Partial<DatatableView> = {},
): DatatableView {
  return {
    createdAt: new Date(0),
    createdBy: extras.createdBy ?? "usr_1",
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
