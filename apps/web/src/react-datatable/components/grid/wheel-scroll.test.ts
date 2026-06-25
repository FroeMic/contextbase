import { describe, expect, test } from "vitest"
import { resolveForwardedWheelScroll } from "./wheel-scroll"

describe("resolveForwardedWheelScroll", () => {
  test("clamps forwarded wheel scrolling to virtual scroll bounds", () => {
    expect(
      resolveForwardedWheelScroll({
        currentScrollLeft: 95,
        currentScrollTop: 180,
        deltaX: 20,
        deltaY: 50,
        contentWidth: 300,
        contentHeight: 500,
        viewportWidth: 200,
        viewportHeight: 300,
      }),
    ).toEqual({
      didScroll: true,
      scrollLeft: 100,
      scrollTop: 200,
    })
  })

  test("reports no scroll when the wheel delta cannot move inside the virtual bounds", () => {
    expect(
      resolveForwardedWheelScroll({
        currentScrollLeft: 0,
        currentScrollTop: 0,
        deltaX: -20,
        deltaY: -50,
        contentWidth: 300,
        contentHeight: 500,
        viewportWidth: 200,
        viewportHeight: 300,
      }),
    ).toEqual({
      didScroll: false,
      scrollLeft: 0,
      scrollTop: 0,
    })
  })
})
