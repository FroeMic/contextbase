import { describe, expect, test } from "vitest"

import { resolveScrollableGridGeometry } from "./scrollable-grid-geometry"

describe("scrollable grid geometry", () => {
  test("does not add horizontal overflow when vertical scrollbar width is already in the column total", () => {
    const geometry = resolveScrollableGridGeometry({
      frozenHeight: 0,
      frozenWidth: 0,
      height: 600,
      measuredVerticalScrollbarWidth: 12,
      totalHeight: 1200,
      totalWidth: 988,
      width: 1000,
    })

    expect(geometry.scrollableViewportWidth).toBe(1000)
    expect(geometry.scrollableClientWidth).toBe(988)
    expect(geometry.scrollableContentWidth).toBe(988)
    expect(geometry.scrollContainerPaddingRight).toBe(0)
    expect(geometry.hasHorizontalOverflow).toBe(false)
  })

  test("still reports horizontal overflow when real column width exceeds the scrollbar-adjusted client width", () => {
    const geometry = resolveScrollableGridGeometry({
      frozenHeight: 0,
      frozenWidth: 0,
      height: 600,
      measuredVerticalScrollbarWidth: 12,
      totalHeight: 1200,
      totalWidth: 1100,
      width: 1000,
    })

    expect(geometry.scrollableClientWidth).toBe(988)
    expect(geometry.scrollableContentWidth).toBe(1100)
    expect(geometry.hasHorizontalOverflow).toBe(true)
  })
})
