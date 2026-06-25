import { describe, expect, test } from "vitest"
import {
  buildSparseVirtualRows,
  getInitialVirtualPageOffsets,
  getVirtualPageOffsetsForRange,
} from "./virtual-online-data"

describe("virtual online data page planning", () => {
  test("keeps initial mount warmup to the first page only", () => {
    expect(
      getInitialVirtualPageOffsets({
        pageSize: 250,
        totalDataRows: 1200,
        prefetchRows: 100,
      }),
    ).toEqual([0])
  })

  test("keeps range prefetch able to cross into adjacent pages after first paint", () => {
    expect(
      getVirtualPageOffsetsForRange({
        rowStartIndex: 0,
        rowStopIndex: 249,
        pageSize: 250,
        totalDataRows: 1200,
        overscanPages: 0,
        prefetchRows: 100,
      }),
    ).toEqual([0, 250])
  })

  test("uses explicit data indices from online responses when rows are omitted", () => {
    const rows = buildSparseVirtualRows({
      pageSize: 50,
      totalDataRows: 2,
      pagesByOffset: new Map([
        [
          0,
          {
            facets: {},
            hasMore: false,
            rows: [
              {
                dataIndex: 1,
                groupPath: ["status:todo"],
                item: { id: "tsk_todo" },
                rowId: "tsk_todo",
                type: "data",
              },
            ],
            totalDataRows: 2,
            totalRenderedRows: 2,
          },
        ],
      ]),
    })

    expect(rows).toEqual([
      { dataIndex: 0, groupPath: [], rowId: "__loading_0", type: "loading" },
      {
        data: { id: "tsk_todo" },
        dataIndex: 1,
        groupPath: ["status:todo"],
        rowId: "tsk_todo",
        type: "data",
      },
    ])
  })
})
