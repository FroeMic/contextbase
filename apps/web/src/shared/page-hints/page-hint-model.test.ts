import { describe, expect, test } from "vitest"

import {
  getMeasuredPageHintCollapsedStackHeight,
  getMeasuredPageHintExpandedY,
  getPageHintStackItems,
  visiblePageHints,
} from "./page-hint-model"

describe("page hint model", () => {
  test("keeps only non-dismissed hints in author order", () => {
    expect(
      visiblePageHints(
        [
          { description: "First", key: "first", title: "First" },
          { description: "Second", key: "second", title: "Second" },
          { description: "Third", key: "third", title: "Third" },
        ],
        new Set(["second"]),
      ).map((hint) => hint.key),
    ).toEqual(["first", "third"])
  })

  test("returns a sonner-like overlapping stack that expands upward on hover", () => {
    const items = getPageHintStackItems([
      { description: "First", key: "first", title: "First" },
      { description: "Second", key: "second", title: "Second" },
      { description: "Third", key: "third", title: "Third" },
      { description: "Fourth", key: "fourth", title: "Fourth" },
    ])

    expect(items.map((item) => item.hint.key)).toEqual(["first", "second", "third"])
    expect(items).toEqual([
      expect.objectContaining({ index: 0, isTop: true, zIndex: 3 }),
      expect.objectContaining({ index: 1, isTop: false, zIndex: 2 }),
      expect.objectContaining({ index: 2, isTop: false, zIndex: 1 }),
    ])
    expect(items[1]?.style).toMatchObject({
      "--page-hint-expanded-y": "calc(-1 * (100% + 0.375rem))",
      "--page-hint-opacity": "1",
      "--page-hint-scale-x": "0.9",
      "--page-hint-y": "-14px",
    })
    expect(items[2]?.style).toMatchObject({
      "--page-hint-expanded-y": "calc(-2 * (100% + 0.375rem))",
      "--page-hint-opacity": "1",
      "--page-hint-scale-x": "0.8",
      "--page-hint-y": "-28px",
    })
  })

  test("keeps collapsed top peeks evenly spaced when card heights differ", () => {
    const heights = {
      another: 132,
      short: 120,
      tall: 180,
    }
    const measuredItems = getPageHintStackItems(
      [
        { description: "Short", key: "short", title: "Short" },
        { description: "Tall content", key: "tall", title: "Tall" },
        { description: "Another", key: "another", title: "Another" },
      ],
      undefined,
      heights,
    )
    const topEdges = measuredItems.map((item) => {
      const y = Number.parseFloat(String(item.style["--page-hint-y"]))
      return y - heights[item.hint.key as keyof typeof heights]
    })

    expect(topEdges[0] - topEdges[1]).toBe(14)
    expect(topEdges[1] - topEdges[2]).toBe(14)
    expect(getMeasuredPageHintCollapsedStackHeight(measuredItems, heights)).toBe("148px")
  })

  test("expands stacked cards by the cumulative measured heights below them", () => {
    const items = getPageHintStackItems([
      { description: "Short", key: "short", title: "Short" },
      { description: "Tall content", key: "tall", title: "Tall" },
      { description: "Another", key: "another", title: "Another" },
    ])

    expect(
      getMeasuredPageHintExpandedY(items, {
        another: 180,
        short: 214,
        tall: 148,
      }),
    ).toEqual({
      another: "-374px",
      short: "0px",
      tall: "-220px",
    })
  })
})
