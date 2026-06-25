import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const readEngineGridRendererSource = () =>
  readFileSync(
    join(process.cwd(), "src/react-datatable/components/grid/EngineGridRenderer.tsx"),
    "utf8",
  )

describe("EngineGridRenderer scroll handling", () => {
  test("does not intercept native wheel events on the main scroll container", () => {
    const source = readEngineGridRendererSource()

    expect(source).not.toContain('element.addEventListener("wheel"')
  })

  test("keeps wheel forwarding for frozen panes without React passive wheel events", () => {
    const source = readEngineGridRendererSource()

    expect(source).toContain("forwardWheelToScrollContainer")
    expect(source).toContain("addFrozenWheelForwardingListener")
    expect(source).toContain('pane.addEventListener("wheel", handleWheel, { passive: false })')
    expect(source).not.toContain("onWheel={forwardWheelToScrollContainer}")
  })

  test("batches scroll processing through requestAnimationFrame", () => {
    const source = readEngineGridRendererSource()

    expect(source).toContain("scrollUpdateFrameRef")
    expect(source).toContain("const processScrollUpdate = () =>")
    expect(source).toContain("window.requestAnimationFrame(processScrollUpdate)")
  })

  test("batches scrollbar measurement and skips unchanged values", () => {
    const source = readEngineGridRendererSource()

    expect(source).toContain("scrollbarMeasureFrameRef")
    expect(source).toContain("lastMeasuredScrollbarRef")
    expect(source).toContain("const scheduleScrollbarMeasure = () =>")
    expect(source).toContain("window.requestAnimationFrame(measureScrollbar)")
  })
})
