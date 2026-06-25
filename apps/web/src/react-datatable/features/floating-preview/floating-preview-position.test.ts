import { describe, expect, test } from "vitest"
import { getDefaultFloatingPreviewPosition } from "./floating-preview-position"

describe("floating preview default position", () => {
  test("opens near the user's mouse horizontally and in the upper third vertically", () => {
    expect(
      getDefaultFloatingPreviewPosition({
        anchorPoint: { x: 420, y: 700 },
        viewportWidth: 1200,
        viewportHeight: 900,
        panelWidth: 384,
        panelHeight: 464,
      }),
    ).toEqual({
      x: 444,
      y: 300,
    })
  })

  test("opens in the upper third and starts at the final horizontal third", () => {
    expect(
      getDefaultFloatingPreviewPosition({
        viewportWidth: 1200,
        viewportHeight: 900,
        panelWidth: 384,
        panelHeight: 464,
      }),
    ).toEqual({
      x: 800,
      y: 300,
    })
  })

  test("clamps the default position when the panel would overflow", () => {
    expect(
      getDefaultFloatingPreviewPosition({
        viewportWidth: 900,
        viewportHeight: 520,
        panelWidth: 384,
        panelHeight: 464,
      }),
    ).toEqual({
      x: 500,
      y: 40,
    })
  })
})
