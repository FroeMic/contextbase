import { describe, expect, test } from "vitest"
import { createDatatableStore } from "./create-datatable-store"

describe("createDatatableStore query options", () => {
  test("stores and clears the preview opening pointer anchor", () => {
    const store = createDatatableStore()

    expect(store.getState().previewAnchorPoint).toBe(null)

    store.getState().setPreviewRow("row-2", { x: 120, y: 240 })

    expect(store.getState().previewRowId).toBe("row-2")
    expect(store.getState().previewAnchorPoint).toEqual({ x: 120, y: 240 })

    store.getState().setPreviewRow("row-3")

    expect(store.getState().previewRowId).toBe("row-3")
    expect(store.getState().previewAnchorPoint).toEqual({ x: 120, y: 240 })

    store.getState().setPreviewRow(null)

    expect(store.getState().previewRowId).toBe(null)
    expect(store.getState().previewAnchorPoint).toBe(null)
  })

  test("updates and resets domain query options", () => {
    const store = createDatatableStore({
      queryOptions: {
        showSubtasks: true,
      },
    })

    expect(store.getState().queryOptions).toEqual({ showSubtasks: true })

    store.getState().setQueryOption("density", "compact")
    expect(store.getState().queryOptions).toEqual({
      showSubtasks: true,
      density: "compact",
    })

    store.getState().setQueryOptions({
      showSubtasks: false,
      pageSize: 100,
    })
    expect(store.getState().queryOptions).toEqual({
      showSubtasks: false,
      pageSize: 100,
    })

    store.getState().resetQueryOptions()
    expect(store.getState().queryOptions).toEqual({})
  })
})
